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
	process.env.RENARR_DATA_DIR = mkdtempSync(join(tmpdir(), 'renarr-test-'));
	process.env.RENARR_SECRET_KEY = secret;
	const { getSqlite } = await import('$lib/server/db');
	return getSqlite();
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

describe('V1 core flows', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('settings save keeps masked TMDB API key unchanged', async () => {
		const db = await freshDb();
		const { saveSettings, publicSettings, getSettings } = await import('./settings');

		saveSettings({ tmdbApiKey: 'abcd1234secret5678', namingLanguage: 'zh-CN' });
		expect(publicSettings().tmdbApiKey).toBe('abcd...5678');

		saveSettings({ tmdbApiKey: 'abcd...5678', metadataEnabled: false });
		expect(getSettings().tmdbApiKey).toBe('abcd1234secret5678');
		expect(getSettings().metadataEnabled).toBe(false);

		db.close();
	});

	test('TMDB connectivity failure returns a stable code without leaking the API key to logs', async () => {
		const db = await freshDb();
		const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);
		const { testTmdbConnection } = await import('./tmdb');

		await expect(testTmdbConnection({ apiKey: 'secret-tmdb-key' })).rejects.toMatchObject({
			code: 'tmdb.unauthorized'
		});

		const logs = db.prepare('select message, context_json from logs').all() as {
			message: string;
			context_json: string;
		}[];
		expect(JSON.stringify(logs)).not.toContain('secret-tmdb-key');
		db.close();
	});

	test('scanLibraryPath skips pending review items', async () => {
		const rootList = vi.fn(async () => [{ basename: 'Show1', type: 'directory' }]);
		await freshDb();
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
			getClientForSource: () => ({ listDirectory: rootList })
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'pending_review', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { scanLibraryPath } = await import('./scanner');

		await scanLibraryPath('lib1');

		expect(rootList).toHaveBeenCalledTimes(1);
		expect(db.prepare('select status from library_items where id = ?').get('item1')).toEqual({
			status: 'pending_review'
		});
		db.close();
	});

	test('scanLibraryPath inherits identity for a discovered rename target folder', async () => {
		const rootList = vi.fn(async (path: string) =>
			path === '/tv'
				? [{ basename: 'Show1 (2026)', type: 'directory' }]
				: [{ basename: 'Show1.2026.s01e01.mkv', type: 'file' }]
		);
		await freshDb();
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
			getClientForSource: () => ({ listDirectory: rootList })
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  original_title, year, confidence, video_file_count, compliant_file_count, non_compliant_file_count,
			  unknown_file_count, created_at, updated_at)
			 values ('oldItem', 'lib1', 'folder', 'XShow1', 'failed', 'tmdb', 'tv', '100', 'Show1',
			  'Show1', 2026, 'manual', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'executed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'oldItem', '/tv/XShow1/01.mkv',
			  '/tv/Show1 (2026)/Show1.2026.s01e01.mkv', 'Show1 (2026)', 'tv', '100', 1, 1, 0, '[]', 'failed')`
		).run();
		const { scanLibraryPath } = await import('./scanner');

		await scanLibraryPath('lib1');

		expect(
			db
				.prepare('select top_level_path, status, source_media_id, title, year from library_items where top_level_path = ?')
				.get('Show1 (2026)')
		).toEqual({
			top_level_path: 'Show1 (2026)',
			status: 'organized',
			source_media_id: '100',
			title: 'Show1',
			year: 2026
		});
		db.close();
	});

	test('scanLibraryItem rejects statuses that require user action first', async () => {
		await freshDb();
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
			getClientForSource: () => ({ listDirectory: vi.fn() })
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { scanLibraryItem } = await import('./scanner');

		await expect(scanLibraryItem('item1')).rejects.toMatchObject({ code: 'item.scan_not_allowed' });
		db.close();
	});

	test('scanLibraryItem converts legacy failed items without identity to pending review', async () => {
		await freshDb();
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
			getClientForSource: () => ({ listDirectory: vi.fn() })
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'failed', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { scanLibraryItem } = await import('./scanner');

		await expect(scanLibraryItem('item1')).rejects.toMatchObject({ code: 'item.scan_not_allowed' });

		expect(db.prepare('select status, review_reason from library_items where id = ?').get('item1')).toEqual({
			status: 'pending_review',
			review_reason: 'legacy_failed'
		});
		db.close();
	});

	test('manual draft submits only selected rows into a confirmed manual plan', async () => {
		await freshDb();
		const exists = vi.fn(async (path: string) => path.endsWith('.srt'));
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
				listDirectory: vi.fn(async () => [
					{ basename: 'Show1.S01E01.mkv', type: 'file' },
					{ basename: 'Show1.S01E02.mkv', type: 'file' }
				]),
				exists
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 2, 0, 2, 0, 'now', 'now')`
		).run();
		const { createDraftForItem, submitDraft, updateDraft } = await import('./planner');

		const draft = await createDraftForItem('item1');
		await updateDraft(draft.id, { rows: [{ id: draft.rows[1].id, selected: false }] });
		await submitDraft(draft.id);

		expect(db.prepare('select mode, status from rename_plans').get()).toEqual({
			mode: 'manual',
			status: 'confirmed'
		});
		expect(db.prepare('select count(*) as count from rename_plan_items').get()).toEqual({ count: 1 });
		db.close();
	});

	test('draft row identity override recomputes only that row target path', async () => {
		await freshDb();
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
				listDirectory: vi.fn(async () => [{ basename: 'Show1.S01E01.mkv', type: 'file' }]),
				exists: vi.fn(async () => false)
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		const { createDraftForItem, updateDraft } = await import('./planner');

		const draft = await createDraftForItem('item1');
		const updated = await updateDraft(draft.id, {
			rows: [
				{
					id: draft.rows[0].id,
					sourceMediaId: '200',
					title: 'Other Show',
					originalTitle: 'Other Show',
					year: 2025,
					posterPath: '/other.jpg',
					posterUrl: null
				}
			]
		});

		expect(updated.rows[0]).toMatchObject({
			sourceMediaId: '200',
			title: 'Other Show',
			year: 2025,
			season: 1,
			episode: 1,
			targetTopLevelPath: 'Other Show (2025)'
		});
		expect(updated.rows[0].targetFilePath).toContain('/tv/Other Show (2025)/');
		expect(db.prepare('select source_media_id, title from library_items where id = ?').get('item1')).toEqual({
			source_media_id: '100',
			title: 'Show1'
		});
		db.close();
	});

	test('item detail derives real-time file compliance without media file rows', async () => {
		await freshDb();
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
				listDirectory: vi.fn(async () => [
					{ basename: 'Show1.S01E01.mkv', type: 'file' },
					{ basename: 'random.mkv', type: 'file' },
					{ basename: 'poster.jpg', type: 'file' }
				])
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'organized', 2, 1, 1, 0, 'now', 'now')`
		).run();
		const { getItemDetail } = await import('./items');

		const detail = await getItemDetail('item1');

		expect(detail.files.map((file) => [file.basename, file.compliance.state])).toEqual([
			['Show1.S01E01.mkv', 'compliant'],
			['random.mkv', 'non_compliant'],
			['poster.jpg', 'not_video']
		]);
		expect(() => db.prepare('select * from media_files').all()).toThrow();
		db.close();
	});

	test('draft submit rejects selected rows with missing TV mapping', async () => {
		await freshDb();
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
				listDirectory: vi.fn(async () => [{ basename: 'Show1.random.mkv', type: 'file' }]),
				exists: vi.fn(async () => false)
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		const { createDraftForItem, submitDraft } = await import('./planner');

		const draft = await createDraftForItem('item1');

		expect(draft.rows[0].status).toBe('invalid');
		await expect(submitDraft(draft.id)).rejects.toMatchObject({ code: 'plan.invalid' });
		db.close();
	});

	test('manual identity selection only saves identity and moves item to identified', async () => {
		const db = await freshDb();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Unknown', 'pending_review', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { setItemIdentity } = await import('./items');

		const item = setItemIdentity('item1', {
			sourceMediaType: 'tv',
			sourceMediaId: '42',
			title: 'Show1',
			originalTitle: 'Show1',
			year: 2024
		});

		expect(item.status).toBe('identified');
		expect(db.prepare('select count(*) as count from tasks').get()).toEqual({ count: 0 });
		db.close();
	});

	test('manual identity selection works for pending review items without candidates', async () => {
		const db = await freshDb();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'FailedShow', 'pending_review', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { setItemIdentity } = await import('./items');

		const item = setItemIdentity('item1', {
			sourceMediaType: 'tv',
			sourceMediaId: '42',
			title: 'Show1',
			originalTitle: 'Show1',
			year: 2024
		});

		expect(item.status).toBe('identified');
		expect(item.sourceMediaId).toBe('42');
		db.close();
	});

	test('legacy failed items with identity can create a manual plan draft', async () => {
		await freshDb();
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
				listDirectory: vi.fn(async () => [{ basename: 'Show1.S01E01.mkv', type: 'file' }]),
				exists: vi.fn(async () => false)
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'failed', 'tmdb', 'tv', '100', 'Show1',
			  2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		const { createDraftForItem } = await import('./planner');

		const draft = await createDraftForItem('item1');

		expect(draft.rows).toHaveLength(1);
		expect(draft.rows[0].status).toBe('valid');
		db.close();
	});

	test('executor continues after a missing source and returns partially_failed', async () => {
		await freshDb();
		const moves: string[] = [];
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/movies',
				mediaType: 'movie',
				autoOrganize: false,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({
				exists: vi.fn(async (path: string) => path === '/movies/source1.mkv'),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					moves.push(`${from}->${to}`);
					return { ok: true };
				}),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'file', 'source1.mkv', 'identified', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		for (const [id, source, target] of [
			['row1', '/movies/source1.mkv', '/movies/Movie (2024)/Movie.2024.mkv'],
			['row2', '/movies/missing.mkv', '/movies/Movie (2024)/Movie.2024b.mkv']
		]) {
			db.prepare(
				`insert into rename_plan_items
				 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
				  media_kind, source_media_id, overwrite, sidecars_json, status)
				 values (?, 'plan1', 'item1', ?, ?, 'Movie (2024)', 'movie', '1', 0, '[]', 'pending')`
			).run(id, source, target);
		}
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toBe('partially_failed');
		expect(moves).toEqual(['/movies/source1.mkv->/movies/Movie (2024)/Movie.2024.mkv']);
		expect(db.prepare('select count(*) as count from execution_records').get()).toEqual({ count: 2 });
		expect(db.prepare('select status from library_items where id = ?').get('item1')).toEqual({
			status: 'identified'
		});
		db.close();
	});

	test('executor blocks target conflict without overwrite', async () => {
		await freshDb();
		const moveFile = vi.fn(async () => ({ ok: true }));
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/movies',
				mediaType: 'movie',
				autoOrganize: false,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({
				exists: vi.fn(async (path: string) => path === '/movies/source1.mkv' || path.includes('/Movie.2024.mkv')),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'file', 'source1.mkv', 'identified', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'auto', 'confirmed', '{}', 'worker', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/movies/source1.mkv', '/movies/Movie (2024)/Movie.2024.mkv',
			  'Movie (2024)', 'movie', '1', 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toBe('failed');
		expect(moveFile).not.toHaveBeenCalled();
		expect(db.prepare('select status from library_items where id = ?').get('item1')).toEqual({
			status: 'identified'
		});
		db.close();
	});

	test('manual overwrite allows target conflict and records sidecar and metadata warnings', async () => {
		await freshDb();
		const moveFile = vi.fn(async (from: string) => {
			if (from.endsWith('.srt')) throw new Error('sidecar denied');
			return { ok: true };
		});
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/movies',
				mediaType: 'movie',
				autoOrganize: false,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({
				exists: vi.fn(async (path: string) =>
					[
						'/movies/source1.mkv',
						'/movies/source1.srt',
						'/movies/Movie (2024)/Movie.2024.mkv'
					].includes(path)
				),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				writeTextFile: vi.fn(async () => {
					throw new Error('metadata denied');
				})
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'file', 'source1.mkv', 'identified', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into app_settings (id, value_json, updated_at)
			 values ('global', '{"metadataEnabled":true,"overwriteMetadata":false}', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/movies/source1.mkv', '/movies/Movie (2024)/Movie.2024.mkv',
			  'Movie (2024)', 'movie', '1', 1, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toBe('succeeded');
		const record = db.prepare('select context_json from execution_records where status = ?').get('succeeded') as {
			context_json: string;
		};
		expect(JSON.parse(record.context_json).warnings).toHaveLength(2);
		expect(moveFile).toHaveBeenCalled();
		expect(
			db
				.prepare(
					`select status, video_file_count, compliant_file_count, non_compliant_file_count,
					 last_execution_summary_json from library_items where id = ?`
				)
				.get('item1')
		).toEqual({
			status: 'organized',
			video_file_count: 1,
			compliant_file_count: 1,
			non_compliant_file_count: 0,
			last_execution_summary_json: JSON.stringify({ ok: 1, failed: 0 })
		});
		db.close();
	});

	test('executor resumes an Alist cross-directory rename left at the intermediate path', async () => {
		await freshDb();
		const moveFile = vi.fn(async () => ({ ok: true }));
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
				exists: vi.fn(async (path: string) => path === '/tv/Show (2026)/Season 01/01.mp4'),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/db')).getSqlite();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'OldShow', 'identified', 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/tv/OldShow/Season 01/01.mp4',
			  '/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4', 'Show (2026)', 'tv', '100', 1, 1, 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toBe('succeeded');
		expect(moveFile).toHaveBeenCalledWith(
			'/tv/Show (2026)/Season 01/01.mp4',
			'/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4',
			{ overwrite: false }
		);
		const record = db.prepare('select context_json from execution_records where status = ?').get('succeeded') as {
			context_json: string;
		};
		expect(JSON.parse(record.context_json).warnings).toContainEqual({
			type: 'resumed_intermediate_move',
			originalSource: '/tv/OldShow/Season 01/01.mp4',
			intermediate: '/tv/Show (2026)/Season 01/01.mp4'
		});
		expect(
			db
				.prepare(
					`select status, video_file_count, compliant_file_count, non_compliant_file_count,
					 last_execution_summary_json from library_items where id = ?`
				)
				.get('item1')
		).toEqual({
			status: 'organized',
			video_file_count: 1,
			compliant_file_count: 1,
			non_compliant_file_count: 0,
			last_execution_summary_json: JSON.stringify({ ok: 1, failed: 0 })
		});
		db.close();
	});
});
