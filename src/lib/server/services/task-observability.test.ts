import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const secret = Buffer.from('12345678901234567890123456789012').toString('base64');

async function freshDb() {
	vi.resetModules();
	vi.clearAllMocks();
	vi.doUnmock('./sources');
	vi.doUnmock('./tmdb');
	process.env.RENARR_DATA_DIR = mkdtempSync(join(tmpdir(), 'renarr-observability-test-'));
	process.env.RENARR_SECRET_KEY = secret;
	const { getSqliteForTest, pushCurrentSchemaForTest } = await import('$lib/server/test-db');
	pushCurrentSchemaForTest();
	return getSqliteForTest();
}

function seedLibrary(db: { prepare(sql: string): { run(...params: unknown[]): unknown } }) {
	db.prepare(
		`insert into webdav_sources (id, name, url, username, credential_encrypted, created_at, updated_at)
		 values ('source1', 'dav1', 'https://example.test/dav', 'user', 'encrypted', 'now', 'now')`
	).run();
	db.prepare(
		`insert into library_paths (id, source_id, path, media_type, auto_organize, created_at, updated_at)
		 values ('lib1', 'source1', '/tv', 'tv', 0, 'now', 'now')`
	).run();
}

describe('task observability', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('enqueueTask returns the existing active task for the same target', async () => {
		const db = await freshDb();
		const { enqueueTask, listActiveTasks } = await import('./tasks');

		const first = enqueueTask('scan_library_path', { libraryPathId: 'lib1' });
		const second = enqueueTask('scan_library_path', { libraryPathId: 'lib1' });

		expect(second.id).toBe(first.id);
		expect(listActiveTasks(['libraryPath:lib1'])).toHaveLength(1);
		expect(db.prepare('select count(*) as count from tasks').get()).toEqual({ count: 1 });
		db.close();
	});

	test('active task lookup expands library item keys to related rename tasks', async () => {
		const db = await freshDb();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/tv/Show1/01.mkv', '/tv/Show1 (2024)/Season 01/Show1.2024.s01e01.mkv',
			  'Show1 (2024)', 'tv', '100', 0, '[]', 'pending')`
		).run();
		const { enqueueTask, listActiveTasks, updateTaskProgress } = await import('./tasks');

		const task = enqueueTask('execute_rename_plan', { planId: 'plan1' });
		updateTaskProgress(task.id, {
			phase: 'moving',
			message: 'Processed 1/2',
			current: 1,
			total: 2,
			counts: { succeeded: 1, failed: 0, warnings: 0 }
		});

		expect(listActiveTasks(['libraryItem:item1'])).toMatchObject([
			{
				id: task.id,
				type: 'execute_rename_plan',
				targetKey: 'renamePlan:plan1',
				progress: {
					current: 1,
					total: 2,
					counts: { succeeded: 1, failed: 0, warnings: 0 }
				}
			}
		]);
		db.close();
	});

	test('enqueueTask rejects terminal rename plans', async () => {
		const db = await freshDb();
		seedLibrary(db);
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'executed', '{}', 'web', 'now', 'now')`
		).run();
		const { enqueueTask } = await import('./tasks');

		expect(() => enqueueTask('execute_rename_plan', { planId: 'plan1' })).toThrow(
			'Rename plan has already been executed'
		);
		db.close();
	});

	test('startup failure summarizes interrupted rename task rows', async () => {
		const db = await freshDb();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'executing', '{}', 'web', 'now', 'now')`
		).run();
		for (const [id, status] of [
			['row1', 'succeeded'],
			['row2', 'failed'],
			['row3', 'pending']
		]) {
			db.prepare(
				`insert into rename_plan_items
				 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
				  media_kind, source_media_id, overwrite, sidecars_json, status)
				 values (?, 'plan1', 'item1', ?, ?, 'Show1 (2024)', 'tv', '100', 0, '[]', ?)`
			).run(id, `/tv/Show1/${id}.mkv`, `/tv/Show1 (2024)/${id}.mkv`, status);
		}
		db.prepare(
			`insert into tasks (id, type, target_key, state, payload_json, created_at)
			 values ('task1', 'execute_rename_plan', 'renamePlan:plan1', 'running', '{"planId":"plan1"}', 'now')`
		).run();
		const { failRunningTasksOnStartup, getTask } = await import('./tasks');

		failRunningTasksOnStartup();

		expect(getTask('task1')).toMatchObject({
			state: 'failed',
			resultSummary: {
				interrupted: true,
				succeeded: 1,
				failed: 1,
				pending: 1
			}
		});
		expect(db.prepare('select status from rename_plans where id = ?').get('plan1')).toEqual({
			status: 'executed'
		});
		db.close();
	});

	test('scan task writes progress, recognition logs, and summary', async () => {
		await freshDb();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							results: [
								{
									id: 100,
									name: 'Show1',
									original_name: 'Show1',
									first_air_date: '2024-01-01'
								}
							]
						}),
						{ status: 200 }
					)
			)
		);
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/tv',
				mediaType: 'tv',
				autoOrganize: false,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({
				listDirectory: vi.fn(async (path: string) =>
					path === '/tv'
						? [{ basename: 'Show1', type: 'directory' }]
						: [{ basename: 'Show1.S01E01.mkv', type: 'file' }]
				)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into app_settings (id, value_json, updated_at)
			 values ('global', '{"tmdbApiKey":"key","namingLanguage":"zh-CN"}', 'now')`
		).run();
		const { enqueueTask, finishTask, getTaskDetail } = await import('./tasks');
		const { scanLibraryPath } = await import('./scanner');

		const task = enqueueTask('scan_library_path', { libraryPathId: 'lib1' });
		const summary = await scanLibraryPath('lib1', task.id);
		finishTask(task.id, 'succeeded', undefined, summary);
		const detail = getTaskDetail(task.id);

		expect(detail.task.progress).toMatchObject({ phase: 'completed' });
		expect(detail.task.resultSummary).toMatchObject({ processed: 1, recognized: 1, failed: 0 });
		expect(detail.logs.map((entry) => entry.message)).toContain('Item recognized');
		expect(
			detail.logs.some((entry) => entry.summary?.includes('Show1 recognized as tv Show1'))
		).toBe(true);
		db.close();
	});

	test('cleanup keeps running task logs while removing old completed task logs', async () => {
		const db = await freshDb();
		const { cleanupTaskObservability } = await import('./logs');
		const old = '2000-01-01T00:00:00.000Z';
		db.prepare(
			`insert into tasks (id, type, target_key, state, payload_json, created_at)
			 values ('running1', 'scan_library_path', 'libraryPath:lib1', 'running', '{}', ?),
			        ('done1', 'scan_library_path', 'libraryPath:lib2', 'succeeded', '{}', ?)`
		).run(old, old);
		db.prepare(
			`insert into logs (id, task_id, time, level, component, message, context_json)
			 values ('log1', 'running1', ?, 'info', 'Test', 'Running old', '{}'),
			        ('log2', 'done1', ?, 'info', 'Test', 'Done old', '{}')`
		).run(old, old);

		cleanupTaskObservability({ maxLogRows: 100, maxExecutionRows: 100 });

		expect(db.prepare('select id from logs order by id').all()).toEqual([{ id: 'log1' }]);
		db.close();
	});
});
