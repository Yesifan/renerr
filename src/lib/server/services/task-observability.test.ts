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

	test('scan task writes progress, recognition logs, and summary', async () => {
		await freshDb();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
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
		expect(detail.logs.some((entry) => entry.summary?.includes('Show1 recognized as tv Show1'))).toBe(
			true
		);
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
