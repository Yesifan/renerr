import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { encryptCredential } from '$lib/server/security/credentials';
import { basename, dirname } from './paths';

const secret = Buffer.from('12345678901234567890123456789012').toString('base64');

async function freshDb() {
	vi.resetModules();
	vi.clearAllMocks();
	vi.doUnmock('./sources');
	vi.doUnmock('./tmdb');
	vi.doUnmock('$lib/server/integrations/webdav-client');
	process.env.RENARR_DATA_DIR = mkdtempSync(join(tmpdir(), 'renarr-test-'));
	process.env.RENARR_SECRET_KEY = secret;
	const { getSqliteForTest, pushCurrentSchemaForTest } = await import('$lib/server/test-db');
	pushCurrentSchemaForTest();
	return getSqliteForTest();
}

function seedLibrary(db: { prepare(sql: string): { run(...params: unknown[]): unknown } }) {
	db.prepare(
		`insert into webdav_sources (id, name, url, username, credential_encrypted, created_at, updated_at)
		 values ('source1', 'dav1', 'https://example.test/dav', 'user', ?, 'now', 'now')`
	).run(encryptCredential('password'));
	db.prepare(
		`insert into library_paths (id, source_id, path, media_type, auto_organize, created_at, updated_at)
		 values ('lib1', 'source1', '/tv', 'tv', 0, 'now', 'now')`
	).run();
}

function listRemoteDirectory(remotePaths: Set<string>, path: string) {
	return [...remotePaths]
		.filter((remotePath) => dirname(remotePath) === path)
		.map((remotePath) => ({ basename: basename(remotePath), type: 'file' as const }));
}

describe('V1 core flows', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
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

	test('TMDB connectivity failure returns a stable code without leaking the API key in errors', async () => {
		const db = await freshDb();
		const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);
		const { testTmdbConnection } = await import('./tmdb');

		const promise = testTmdbConnection({ apiKey: 'secret-tmdb-key' });
		await expect(promise).rejects.toMatchObject({
			code: 'tmdb.unauthorized'
		});
		await expect(promise).rejects.not.toThrow('secret-tmdb-key');
		db.close();
	});

	test('TMDB TV options expose season zero and episode metadata without leaking keys', async () => {
		const db = await freshDb();
		const { saveSettings } = await import('./settings');
		saveSettings({ tmdbApiKey: 'secret-tmdb-key', namingLanguage: 'zh-CN' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: string | URL | Request) => {
				const url = new URL(String(input));
				if (url.pathname.endsWith('/tv/100')) {
					return new Response(
						JSON.stringify({
							seasons: [
								{ season_number: 1, name: 'Season 1', episode_count: 8, air_date: '2026-01-01' },
								{ season_number: 0, name: 'Specials', episode_count: 1, air_date: null }
							]
						})
					);
				}
				if (url.pathname.endsWith('/tv/100/season/0')) {
					return new Response(
						JSON.stringify({
							episodes: [
								{
									episode_number: 1,
									name: 'Special Episode',
									air_date: '2026-02-01',
									overview: 'Behind the scenes'
								}
							]
						})
					);
				}
				return new Response('{}', { status: 404 });
			})
		);
		const { listTmdbTvSeasons, listTmdbTvSeasonEpisodes } = await import('./tmdb');

		await expect(listTmdbTvSeasons(100)).resolves.toEqual([
			{ number: 0, name: 'Specials', episodeCount: 1, airDate: null },
			{ number: 1, name: 'Season 1', episodeCount: 8, airDate: '2026-01-01' }
		]);
		await expect(listTmdbTvSeasonEpisodes(100, 0)).resolves.toEqual([
			{
				season: 0,
				episode: 1,
				name: 'Special Episode',
				airDate: '2026-02-01',
				overview: 'Behind the scenes'
			}
		]);
		db.close();
	});

	test('TMDB TV option failures use stable codes and empty TMDB data stays empty', async () => {
		const db = await freshDb();
		const { listTmdbTvSeasons } = await import('./tmdb');

		await expect(listTmdbTvSeasons(100)).rejects.toMatchObject({ code: 'tmdb.unauthorized' });

		const { saveSettings } = await import('./settings');
		saveSettings({ tmdbApiKey: 'secret-tmdb-key', namingLanguage: 'zh-CN' });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{}'))
		);
		const tmdb = await import('./tmdb');
		await expect(tmdb.listTmdbTvSeasons(100)).resolves.toEqual([]);
		await expect(tmdb.listTmdbTvSeasonEpisodes(100, 1)).resolves.toEqual([]);

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{}', { status: 429 }))
		);
		const promise = tmdb.listTmdbTvSeasons(100);
		await expect(promise).rejects.toMatchObject({ code: 'tmdb.rate_limited' });
		await expect(promise).rejects.not.toThrow('secret-tmdb-key');
		db.close();
	});

	test('WebDAV browse suggestions list only direct child directories', async () => {
		const listDirectory = vi.fn(async (path: string) => {
			if (path === '/') {
				return [
					{ basename: 'tv', filename: '/tv', type: 'directory' as const },
					{ basename: 'movie.mkv', filename: '/movie.mkv', type: 'file' as const }
				];
			}
			if (path === '/tv') {
				return [
					{ basename: 'Show10', filename: '/tv/Show10', type: 'directory' as const },
					{ basename: 'Show2', filename: '/tv/Show2', type: 'directory' as const },
					{ basename: 'episode.mkv', filename: '/tv/episode.mkv', type: 'file' as const }
				];
			}
			throw new Error('unexpected path');
		});
		await freshDb();
		vi.doMock('$lib/server/integrations/webdav-client', () => ({
			WebDavFileClient: class {
				listDirectory = listDirectory;
			}
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		const { upsertSource, browseWebdav } = await import('./sources');
		const source = upsertSource({
			name: 'dav',
			url: 'https://example.test/dav',
			username: 'user',
			credential: 'secret'
		});

		await expect(browseWebdav(source.id, '/')).resolves.toEqual([
			{ basename: 'tv', filename: '/tv', type: 'directory' }
		]);
		await expect(browseWebdav(source.id, '/tv')).resolves.toEqual([
			{ basename: 'Show2', filename: '/tv/Show2', type: 'directory' },
			{ basename: 'Show10', filename: '/tv/Show10', type: 'directory' }
		]);
		expect(listDirectory).toHaveBeenCalledTimes(2);
		expect(listDirectory).toHaveBeenNthCalledWith(1, '/');
		expect(listDirectory).toHaveBeenNthCalledWith(2, '/tv');
		db.close();
	});

	test('WebDAV browse suggestions return stable errors for unreadable paths', async () => {
		const listDirectory = vi.fn(async () => {
			throw new Error('permission denied: secret-password');
		});
		await freshDb();
		vi.doMock('$lib/server/integrations/webdav-client', () => ({
			WebDavFileClient: class {
				listDirectory = listDirectory;
			}
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		const { upsertSource, browseWebdav } = await import('./sources');
		const source = upsertSource({
			name: 'dav',
			url: 'https://example.test/dav',
			username: 'user',
			credential: 'secret-password'
		});

		const promise = browseWebdav(source.id, '/private');
		await expect(promise).rejects.toMatchObject({ code: 'webdav.path_unreadable' });
		await expect(promise).rejects.not.toThrow('secret-password');
		db.close();
	});

	test('scanLibraryPath skips pending review recognition while refreshing stats', async () => {
		const rootList = vi.fn(async (path: string) =>
			path === '/tv'
				? [{ basename: 'Show1', type: 'directory' }]
				: [{ basename: 'Show1.2024.s01e01.mkv', type: 'file' }]
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'pending_review', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { scanLibraryPath } = await import('./scanner');

		await scanLibraryPath('lib1');

		expect(
			db.prepare('select status, video_file_count from library_items where id = ?').get('item1')
		).toEqual({
			status: 'pending_review',
			video_file_count: 1
		});
		db.close();
	});

	test('empty folders are hidden by default but inspectable explicitly', async () => {
		const rootList = vi.fn(async (path: string) =>
			path === '/tv' ? [{ basename: 'EmptyShow', type: 'directory' }] : []
		);
		await freshDb();
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/tv',
				mediaType: 'tv',
				autoOrganize: true,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({ listDirectory: rootList })
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		const { scanLibraryPath } = await import('./scanner');
		const { getItem, listItems } = await import('./items');

		const summary = await scanLibraryPath('lib1');
		const row = db
			.prepare(
				'select id, status, video_file_count, compliant_file_count, non_compliant_file_count from library_items'
			)
			.get() as { id: string };

		expect(summary).toMatchObject({ processed: 1, skipped: 1, failed: 0 });
		expect(listItems('lib1')).toEqual([]);
		expect(listItems({ libraryPathId: 'lib1', includeEmpty: true })).toHaveLength(1);
		expect(getItem(row.id)).toMatchObject({
			topLevelPath: 'EmptyShow',
			status: 'unidentified',
			videoFileCount: 0,
			empty: true
		});
		expect(db.prepare('select count(*) as count from tasks').get()).toEqual({ count: 0 });
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  original_title, year, confidence, video_file_count, compliant_file_count, non_compliant_file_count,
			  unknown_file_count, created_at, updated_at)
			 values ('oldItem', 'lib1', 'folder', 'XShow1', 'organized', 'tmdb', 'tv', '100', 'Show1',
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
				.prepare(
					'select top_level_path, status, source_media_id, title, year from library_items where top_level_path = ?'
				)
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

	test('scanLibraryItem rejects pending review items that require user action first', async () => {
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
			  non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'pending_review', 0, 0, 0, 0, 'now', 'now')`
		).run();
		const { scanLibraryItem } = await import('./scanner');

		await expect(scanLibraryItem('item1')).rejects.toMatchObject({ code: 'item.scan_not_allowed' });
		db.close();
	});

	test('scanLibraryPath enqueues create plan tasks for identified and dirty organized items', async () => {
		await freshDb();
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/tv',
				mediaType: 'tv',
				autoOrganize: true,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({
				listDirectory: vi.fn(async (path: string) => {
					if (path === '/tv') {
						return [
							{ basename: 'IdentifiedShow', type: 'directory' },
							{ basename: 'DirtyShow', type: 'directory' },
							{ basename: 'CleanShow', type: 'directory' }
						];
					}
					if (path === '/tv/CleanShow') {
						return [{ basename: 'CleanShow.S01E01.mkv', type: 'file' }];
					}
					return [{ basename: 'random.mkv', type: 'file' }];
				})
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		for (const [id, topLevelPath, status] of [
			['identified1', 'IdentifiedShow', 'identified'],
			['dirty1', 'DirtyShow', 'organized'],
			['clean1', 'CleanShow', 'organized']
		]) {
			db.prepare(
				`insert into library_items
				 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id,
				  title, year, video_file_count, compliant_file_count, non_compliant_file_count,
				  unknown_file_count, created_at, updated_at)
				 values (?, 'lib1', 'folder', ?, ?, 'tmdb', 'tv', '100', ?, 2024, 1, 0, 1, 0, 'now', 'now')`
			).run(id, topLevelPath, status, topLevelPath);
		}
		const { scanLibraryPath } = await import('./scanner');

		await scanLibraryPath('lib1');

		expect(
			db
				.prepare(
					`select type, target_key, state from tasks
					 where type = 'create_rename_plan_for_item'
					 order by target_key`
				)
				.all()
		).toEqual([
			{
				type: 'create_rename_plan_for_item',
				target_key: 'libraryItem:dirty1',
				state: 'queued'
			},
			{
				type: 'create_rename_plan_for_item',
				target_key: 'libraryItem:identified1',
				state: 'queued'
			}
		]);
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
		expect(db.prepare('select count(*) as count from rename_plan_items').get()).toEqual({
			count: 1
		});
		db.close();
	});

	test('create rename plan task leaves execution manual when autoOrganize is disabled', async () => {
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id,
			  title, year, video_file_count, compliant_file_count, non_compliant_file_count,
			  unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100',
			  'Show1', 2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		const { runCreateRenamePlanForItemTask } = await import('./planner');

		const summary = await runCreateRenamePlanForItemTask('task1', 'item1');

		expect(summary).toMatchObject({
			itemId: 'item1',
			executableRows: 1,
			autoExecute: false,
			executionTaskId: null
		});
		expect(db.prepare('select status from rename_plans').get()).toEqual({ status: 'confirmed' });
		expect(db.prepare('select count(*) as count from tasks').get()).toEqual({ count: 0 });
		db.close();
	});

	test('create rename plan task queues execution when autoOrganize is enabled', async () => {
		await freshDb();
		vi.doMock('./sources', () => ({
			getLibrary: () => ({
				id: 'lib1',
				sourceId: 'source1',
				sourceName: 'dav1',
				path: '/tv',
				mediaType: 'tv',
				autoOrganize: true,
				createdAt: '',
				updatedAt: ''
			}),
			getClientForSource: () => ({
				listDirectory: vi.fn(async () => [{ basename: 'Show1.S01E01.mkv', type: 'file' }]),
				exists: vi.fn(async () => false)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id,
			  title, year, video_file_count, compliant_file_count, non_compliant_file_count,
			  unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100',
			  'Show1', 2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		const { runCreateRenamePlanForItemTask } = await import('./planner');

		const summary = await runCreateRenamePlanForItemTask('task1', 'item1');

		expect(summary).toMatchObject({
			itemId: 'item1',
			executableRows: 1,
			autoExecute: true
		});
		expect(summary.executionTaskId).toEqual(expect.any(String));
		expect(db.prepare('select type, state from tasks').all()).toEqual([
			{ type: 'execute_rename_plan', state: 'queued' }
		]);
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
		expect(
			db.prepare('select source_media_id, title from library_items where id = ?').get('item1')
		).toEqual({
			source_media_id: '100',
			title: 'Show1'
		});
		db.close();
	});

	test('draft row season edit preserves episode and recomputes target path', async () => {
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
				listDirectory: vi.fn(async () => [{ basename: 'Show1.S01E08.mkv', type: 'file' }]),
				exists: vi.fn(async () => false)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
					season: 2
				}
			]
		});

		expect(updated.rows[0]).toMatchObject({
			season: 2,
			episode: 8,
			status: 'valid'
		});
		expect(updated.rows[0].targetFilePath).toContain('s02e08');
		db.close();
	});

	test('draft no-op rows are skipped and can become executable after edits', async () => {
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
				listDirectory: vi.fn(async (path: string) =>
					path.endsWith('/Season 01')
						? [
								{ basename: 'Show1.2024.s01e01.mkv', type: 'file' },
								{ basename: '02.mkv', type: 'file' }
							]
						: [{ basename: 'Season 01', type: 'directory' }]
				),
				exists: vi.fn(async () => false)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1 (2024)', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 2, 1, 1, 0, 'now', 'now')`
		).run();
		const { createDraftForItem, submitDraft, updateDraft } = await import('./planner');

		const draft = await createDraftForItem('item1');
		const noopRow = draft.rows.find((row) => row.sourceFilePath === row.targetFilePath);
		const renameRow = draft.rows.find((row) => row.sourceFilePath !== row.targetFilePath);

		expect(noopRow).toMatchObject({ noop: true, selected: false, conflict: false });
		expect(renameRow).toMatchObject({ noop: false, selected: true });

		await submitDraft(draft.id);
		expect(db.prepare('select count(*) as count from rename_plan_items').get()).toEqual({
			count: 1
		});

		const secondDraft = await createDraftForItem('item1');
		const secondNoopRow = secondDraft.rows.find((row) => row.sourceFilePath === row.targetFilePath);
		if (!secondNoopRow) throw new Error('Expected no-op row');
		const updated = await updateDraft(secondDraft.id, {
			rows: [
				{
					id: secondNoopRow.id,
					selected: true,
					sourceMediaId: '200',
					title: 'Show2',
					originalTitle: 'Show2',
					year: 2025
				}
			]
		});
		const editedRow = updated.rows.find((row) => row.id === secondNoopRow.id);

		expect(editedRow).toMatchObject({ noop: false, selected: true });
		expect(editedRow?.targetFilePath).toContain('/tv/Show2 (2025)/');
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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

	test('executor continues after a missing source and returns partially_failed', async () => {
		await freshDb();
		const moves: string[] = [];
		const remotePaths = new Set<string>(['/movies/source1.mkv']);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					if (!remotePaths.has(from)) throw new Error(`Source file no longer exists: ${from}`);
					moves.push(`${from}->${to}`);
					remotePaths.delete(from);
					remotePaths.add(to);
					return { ok: true };
				}),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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

		const result = await executeRenamePlan('task1', 'plan1');
		expect(result).toMatchObject({
			state: 'partially_failed',
			summary: {
				moved: 1,
				moveFailed: 1,
				scans: {
					targets: [expect.objectContaining({ type: 'scan_library_path', libraryPathId: 'lib1' })]
				}
			}
		});
		expect(moves).toEqual(['/movies/source1.mkv->/movies/Movie (2024)/Movie.2024.mkv']);
		expect(db.prepare('select type, target_key, state from tasks').all()).toEqual([
			{ type: 'scan_library_path', target_key: 'libraryPath:lib1', state: 'queued' }
		]);
		expect(db.prepare('select status from rename_plan_items order by id').all()).toEqual([
			{ status: 'succeeded' },
			{ status: 'failed' }
		]);
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
				exists: vi.fn(
					async (path: string) => path === '/movies/source1.mkv' || path.includes('/Movie.2024.mkv')
				),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'failed',
			summary: { moved: 0, moveFailed: 1 }
		});
		expect(moveFile).not.toHaveBeenCalled();
		expect(db.prepare('select status from library_items where id = ?').get('item1')).toEqual({
			status: 'identified'
		});
		db.close();
	});

	test('manual overwrite allows target conflict and records sidecar and metadata warnings', async () => {
		await freshDb();
		const remotePaths = new Set<string>([
			'/movies/source1.mkv',
			'/movies/source1.srt',
			'/movies/Movie (2024)/Movie.2024.mkv'
		]);
		const moveFile = vi.fn(async (from: string, to: string) => {
			if (from.endsWith('.srt')) throw new Error('sidecar denied');
			remotePaths.delete(from);
			remotePaths.add(to);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				writeTextFile: vi.fn(async () => {
					throw new Error('metadata denied');
				})
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0, warnings: 2 }
		});
		const lines = db.prepare('select message from task_detail_lines order by id').all() as {
			message: string;
		}[];
		expect(lines.some((line) => line.message.includes('sidecar_move_failed'))).toBe(true);
		expect(lines.some((line) => line.message.includes('metadata_write_failed'))).toBe(true);
		expect(moveFile).toHaveBeenCalled();
		expect(
			db
				.prepare(
					`select status, video_file_count, compliant_file_count, non_compliant_file_count,
					 last_execution_summary_json from library_items where id = ?`
				)
				.get('item1')
		).toEqual({
			status: 'identified',
			video_file_count: 1,
			compliant_file_count: 0,
			non_compliant_file_count: 1,
			last_execution_summary_json: null
		});
		db.close();
	});

	test('executor leaves item stats unchanged after selected rows succeed', async () => {
		await freshDb();
		let moved = false;
		const moveFile = vi.fn(async () => {
			moved = true;
			return { ok: true };
		});
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
				exists: vi.fn(async (path: string) =>
					moved
						? path === '/tv/Show1 (2024)/Season 01/Show1.2024.s01e01.mkv'
						: path === '/tv/Show1 (2024)/Season 01/01.mkv'
				),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				listDirectory: vi.fn(async (path: string) =>
					path.endsWith('/Season 01')
						? [
								{ basename: moved ? 'Show1.2024.s01e01.mkv' : '01.mkv', type: 'file' },
								{ basename: 'Show1.2024.s01e02.mkv', type: 'file' }
							]
						: [{ basename: 'Season 01', type: 'directory' }]
				),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1 (2024)', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 2, 1, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/tv/Show1 (2024)/Season 01/01.mkv',
			  '/tv/Show1 (2024)/Season 01/Show1.2024.s01e01.mkv', 'Show1 (2024)', 'tv', '100', 1, 1, 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0 }
		});

		expect(
			db
				.prepare(
					`select status, video_file_count, compliant_file_count, non_compliant_file_count,
					 last_execution_summary_json from library_items where id = ?`
				)
				.get('item1')
		).toEqual({
			status: 'identified',
			video_file_count: 2,
			compliant_file_count: 1,
			non_compliant_file_count: 1,
			last_execution_summary_json: null
		});
		db.close();
	});

	test('executor records adapter move retry warnings', async () => {
		await freshDb();
		const remotePaths = new Set<string>(['/tv/Show1/01.mkv']);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					remotePaths.delete(from);
					remotePaths.add(to);
					return {
						ok: true,
						warnings: [{ type: 'webdav_move_retry', attempt: 1 }]
					};
				}),
				listDirectory: vi.fn(async (path: string) => listRemoteDirectory(remotePaths, path)),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/tv/Show1/01.mkv',
			  '/tv/Show1 (2024)/Season 01/Show1.2024.s01e01.mkv', 'Show1 (2024)', 'tv', '100', 1, 1, 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0, warnings: 1 }
		});
		const lines = db.prepare('select message from task_detail_lines order by id').all() as {
			message: string;
		}[];
		expect(lines.some((line) => line.message.includes('webdav_move_retry'))).toBe(true);
		db.close();
	});

	test('executor treats successful move return as success without waiting for destination visibility', async () => {
		vi.useFakeTimers();
		await freshDb();
		const remotePaths = new Set<string>(['/tv/Show1/01.mkv']);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					remotePaths.delete(from);
					setTimeout(() => remotePaths.add(to), 5000);
					return { ok: true };
				}),
				listDirectory: vi.fn(async (path: string) => listRemoteDirectory(remotePaths, path)),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'Show1', 'identified', 'tmdb', 'tv', '100', 'Show1',
			  2024, 1, 0, 1, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/tv/Show1/01.mkv',
			  '/tv/Show1/Show1.2024.s01e01.mkv', 'Show1', 'tv', '100', 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		const promise = executeRenamePlan('task1', 'plan1');
		await vi.advanceTimersByTimeAsync(5000);

		await expect(promise).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0 }
		});
		expect(
			db
				.prepare('select message from task_detail_lines where message like ?')
				.get('%/tv/Show1/01.mkv moved to /tv/Show1/Show1.2024.s01e01.mkv successfully%')
		).toBeTruthy();
		db.close();
	});

	test('executor records move error without retrying retryable 500', async () => {
		vi.useFakeTimers();
		await freshDb();
		const remotePaths = new Set<string>(['/movies/source1.mkv']);
		let attempts = 0;
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					attempts += 1;
					if (attempts === 1) {
						remotePaths.delete(from);
						setTimeout(() => remotePaths.add(from), 5000);
						throw new Error('Invalid response: 500 Internal Server Error');
					}
					remotePaths.delete(from);
					remotePaths.add(to);
					return { ok: true };
				}),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/movies/source1.mkv', '/movies/Movie.2024.mkv',
			  'Movie (2024)', 'movie', '1', 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'failed',
			summary: { moved: 0, moveFailed: 1 }
		});
		expect(attempts).toBe(1);
		db.close();
	});

	test('executor does not mark long invisible remote state as indeterminate when move returns ok', async () => {
		vi.useFakeTimers();
		await freshDb();
		const remotePaths = new Set<string>(['/movies/source1.mkv']);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string) => {
					remotePaths.delete(from);
					return { ok: true };
				}),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/movies/source1.mkv', '/movies/Movie.2024.mkv',
			  'Movie (2024)', 'movie', '1', 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0 }
		});
		expect(db.prepare('select status from rename_plan_items where id = ?').get('row1')).toEqual({
			status: 'succeeded'
		});
		db.close();
	});

	test('executor records FileClient cross-directory steps without settling checks', async () => {
		vi.useFakeTimers();
		await freshDb();
		const remotePaths = new Set<string>(['/tv/Show1/01.mkv']);
		let moveCount = 0;
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					moveCount += 1;
					remotePaths.delete(from);
					if (moveCount === 1) remotePaths.add(to);
					return {
						ok: true,
						steps: [
							{ stage: 'rename_in_place', from, to: '/tv/Show1/Show.2024.s01e01.mkv', ok: true },
							{
								stage: 'move_to_target',
								from: '/tv/Show1/Show.2024.s01e01.mkv',
								to,
								ok: true
							}
						]
					};
				}),
				listDirectory: vi.fn(async (path: string) => listRemoteDirectory(remotePaths, path)),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/tv/Show1/01.mkv',
			  '/tv/Show (2024)/Season 01/Show.2024.s01e01.mkv', 'Show (2024)', 'tv', '100', 1, 1, 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0 }
		});
		expect(moveCount).toBe(1);
		const lines = db.prepare('select message from task_detail_lines order by id').all() as {
			message: string;
		}[];
		expect(lines.some((line) => line.message.includes('FileClient rename_in_place'))).toBe(true);
		expect(lines.some((line) => line.message.includes('FileClient move_to_target'))).toBe(true);
		expect(db.prepare('select status from rename_plan_items where id = ?').get('row1')).toEqual({
			status: 'succeeded'
		});
		db.close();
	});

	test('executor does not mark duplicate source and destination state as indeterminate when move returns ok', async () => {
		await freshDb();
		const remotePaths = new Set<string>(['/movies/source1.mkv']);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (_from: string, to: string) => {
					remotePaths.add(to);
					return { ok: true };
				}),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, overwrite, sidecars_json, status)
			 values ('row1', 'plan1', 'item1', '/movies/source1.mkv', '/movies/Movie.2024.mkv',
			  'Movie (2024)', 'movie', '1', 0, '[]', 'pending')`
		).run();
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0 }
		});
		expect(db.prepare('select status from rename_plan_items where id = ?').get('row1')).toEqual({
			status: 'succeeded'
		});
		db.close();
	});

	test('executor delegates each row move to FileClient in row order', async () => {
		await freshDb();
		const remotePaths = new Set<string>(['/tv/OldShow/01.mp4', '/tv/OldShow/02.mp4']);
		const moves: string[] = [];
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile: vi.fn(async (from: string, to: string) => {
					moves.push(`${from}->${to}`);
					remotePaths.delete(from);
					remotePaths.add(to);
					return { ok: true };
				}),
				listDirectory: vi.fn(async (path: string) => listRemoteDirectory(remotePaths, path)),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
		seedLibrary(db);
		db.prepare(
			`insert into library_items
			 (id, library_path_id, kind, top_level_path, status, source, source_media_type, source_media_id, title,
			  year, video_file_count, compliant_file_count, non_compliant_file_count, unknown_file_count, created_at, updated_at)
			 values ('item1', 'lib1', 'folder', 'OldShow', 'identified', 'tmdb', 'tv', '100', 'Show',
			  2026, 2, 0, 2, 0, 'now', 'now')`
		).run();
		db.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values ('plan1', 'lib1', 'manual', 'confirmed', '{}', 'web', 'now', 'now')`
		).run();
		for (const [id, episode] of [
			['row1', 1],
			['row2', 2]
		] as const) {
			db.prepare(
				`insert into rename_plan_items
				 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
				  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
				 values (?, 'plan1', 'item1', ?, ?, 'Show (2026)', 'tv', '100', 1, ?, 0, '[]', 'pending')`
			).run(
				id,
				`/tv/OldShow/0${episode}.mp4`,
				`/tv/Show (2026)/Season 01/Show.2026.s01e0${episode}.mp4`,
				episode
			);
		}
		const { executeRenamePlan } = await import('./executor');

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 2, moveFailed: 0 }
		});
		expect(moves).toEqual([
			'/tv/OldShow/01.mp4->/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4',
			'/tv/OldShow/02.mp4->/tv/Show (2026)/Season 01/Show.2026.s01e02.mp4'
		]);
		db.close();
	});

	test('executor records adapter-resumed intermediate moves from FileClient warnings', async () => {
		await freshDb();
		const moveFile = vi.fn(async () => ({
			ok: true,
			steps: [
				{
					stage: 'move_to_target',
					from: '/tv/OldShow/Season 01/Show.2026.s01e01.mp4',
					to: '/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4',
					ok: true
				}
			],
			warnings: [
				{
					type: 'resumed_intermediate_move',
					originalSource: '/tv/OldShow/Season 01/01.mp4',
					intermediate: '/tv/OldShow/Season 01/Show.2026.s01e01.mp4',
					finalTarget: '/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4'
				}
			]
		}));
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
				exists: vi.fn(async () => false),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				listDirectory: vi.fn(async (path: string) => {
					if (path === '/tv/OldShow/Season 01') {
						return [{ basename: 'Show.2026.s01e01.mp4', type: 'file' }];
					}
					return [];
				}),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'succeeded',
			summary: { moved: 1, moveFailed: 0 }
		});
		expect(moveFile).toHaveBeenCalledWith(
			'/tv/OldShow/Season 01/01.mp4',
			'/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4',
			{ overwrite: false }
		);
		const lines = db.prepare('select message from task_detail_lines order by id').all() as {
			message: string;
		}[];
		expect(lines.some((line) => line.message.includes('resumed_intermediate_move'))).toBe(true);
		expect(
			lines.some((line) =>
				line.message.includes(
					'/tv/OldShow/Season 01/01.mp4 moved to /tv/Show (2026)/Season 01/Show.2026.s01e01.mp4 successfully'
				)
			)
		).toBe(true);
		expect(
			db
				.prepare(
					`select status, video_file_count, compliant_file_count, non_compliant_file_count,
					 last_execution_summary_json from library_items where id = ?`
				)
				.get('item1')
		).toEqual({
			status: 'identified',
			video_file_count: 1,
			compliant_file_count: 0,
			non_compliant_file_count: 1,
			last_execution_summary_json: null
		});
		db.close();
	});

	test('executor records FileClient source-missing failures without legacy recovery', async () => {
		await freshDb();
		const moveFile = vi.fn(async () => {
			throw new Error('source missing');
		});
		const remotePaths = new Set<string>(['/tv/Show (2026)/Season 01/01.mp4']);
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
				exists: vi.fn(async (path: string) => remotePaths.has(path)),
				ensureDirectory: vi.fn(async () => undefined),
				moveFile,
				listDirectory: vi.fn(async () => []),
				writeTextFile: vi.fn(async () => undefined)
			})
		}));
		const db = (await import('$lib/server/test-db')).getSqliteForTest();
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

		await expect(executeRenamePlan('task1', 'plan1')).resolves.toMatchObject({
			state: 'failed',
			summary: { moved: 0, moveFailed: 1 }
		});
		expect(moveFile).toHaveBeenCalledWith(
			'/tv/OldShow/Season 01/01.mp4',
			'/tv/Show (2026)/Season 01/Show.2026.s01e01.mp4',
			{ overwrite: false }
		);
		expect(db.prepare('select status from rename_plan_items where id = ?').get('row1')).toEqual({
			status: 'failed'
		});
		db.close();
	});
});
