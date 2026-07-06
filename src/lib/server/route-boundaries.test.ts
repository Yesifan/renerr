import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const secret = Buffer.from('12345678901234567890123456789012').toString('base64');

async function freshDb() {
	vi.resetModules();
	process.env.RENARR_DATA_DIR = mkdtempSync(join(tmpdir(), 'renarr-route-test-'));
	process.env.RENARR_SECRET_KEY = secret;
	const { closeTestDb, pushCurrentSchemaForTest } = await import('$lib/server/test-db');
	pushCurrentSchemaForTest();
	return { close: closeTestDb };
}

function jsonEvent(
	input: unknown,
	url = 'http://localhost/api/test',
	params: Record<string, string> = {}
) {
	return {
		params,
		request: new Request(url, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input)
		}),
		url: new URL(url)
	};
}

function formEvent(input: Record<string, string | boolean | undefined>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) formData.set(key, String(value));
	}
	return {
		request: new Request('http://localhost/settings/media', {
			method: 'POST',
			body: formData
		})
	};
}

async function responseJson(response: Response) {
	return (await response.json()) as Record<string, unknown>;
}

describe('route and action boundaries', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('settings action preserves masked TMDB key and supports partial updates', async () => {
		const db = await freshDb();
		const { actions } = await import('../../routes/settings/media/+page.server');
		const { getSettings, publicSettings } = await import('$lib/server/services/settings');

		await actions.saveTmdb(formEvent({ tmdbApiKey: 'abcd1234secret5678' }) as never);
		await actions.saveFileSettings(
			formEvent({ namingLanguage: 'en-US', metadataEnabled: false }) as never
		);
		await actions.saveTmdb(formEvent({ tmdbApiKey: publicSettings().tmdbApiKey }) as never);

		expect(getSettings()).toMatchObject({
			tmdbApiKey: 'abcd1234secret5678',
			namingLanguage: 'en-US',
			metadataEnabled: false
		});
		db.close();
	});

	test('settings actions preserve source URL and persist autoOrganize through schemas', async () => {
		const db = await freshDb();
		const { actions } = await import('../../routes/settings/media/+page.server');
		const { listLibraries, listSources } = await import('$lib/server/services/sources');

		await actions.createSource(
			formEvent({
				name: 'dav',
				url: 'https://example.test/dav/root/path?token=abc',
				username: 'user',
				credential: 'secret'
			}) as never
		);
		const [source] = listSources();
		expect(source.url).toBe('https://example.test/dav/root/path?token=abc');

		await actions.createLibrary(
			formEvent({
				sourceId: source.id,
				path: '/Movies',
				mediaType: 'movie',
				autoOrganize: true
			}) as never
		);
		expect(listLibraries()[0].autoOrganize).toBe(true);
		db.close();
	});

	test('settings action returns validation failures for invalid form input', async () => {
		const db = await freshDb();
		const { actions } = await import('../../routes/settings/media/+page.server');

		const result = await actions.createSource(
			formEvent({ name: 'dav', url: 'not-a-url', username: 'user', credential: 'secret' }) as never
		);

		expect(result).toMatchObject({
			status: 400,
			data: { ok: false, code: 'validation_failed' }
		});
		db.close();
	});

	test('narrow JSON APIs validate request bodies before calling services', async () => {
		const db = await freshDb();
		const settingsApi = await import('../../routes/api/settings/+server');
		const sourcesApi = await import('../../routes/api/sources/+server');
		const librariesApi = await import('../../routes/api/libraries/+server');

		expect(
			await responseJson(await settingsApi.PUT(jsonEvent({ unknown: true }) as never))
		).toMatchObject({
			code: 'validation_failed'
		});
		expect(
			await responseJson(await sourcesApi.POST(jsonEvent({ name: 'dav', url: 'bad' }) as never))
		).toMatchObject({
			code: 'validation_failed'
		});
		expect(
			await responseJson(
				await librariesApi.POST(
					jsonEvent({ sourceId: 'source1', path: '/movies', mediaType: 'music' }) as never
				)
			)
		).toMatchObject({ code: 'validation_failed' });
		db.close();
	});

	test('library update API validates partial updates and persists switches', async () => {
		const db = await freshDb();
		const { upsertSource, createLibrary } = await import('$lib/server/services/sources');
		const libraryApi = await import('../../routes/api/libraries/[id]/+server');

		const source = upsertSource({
			name: 'dav',
			url: 'https://example.test/dav',
			username: 'user',
			credential: 'secret'
		});
		const library = createLibrary({
			sourceId: source.id,
			path: '/tv',
			mediaType: 'tv',
			autoOrganize: false
		});

		const invalid = await libraryApi.PUT(
			jsonEvent({ autoOrganize: true, path: '/other' }, 'http://localhost/api/libraries/id', {
				id: library.id
			}) as never
		);
		expect(await responseJson(invalid)).toMatchObject({ code: 'validation_failed' });

		const valid = await libraryApi.PUT(
			jsonEvent({ autoOrganize: true }, 'http://localhost/api/libraries/id', {
				id: library.id
			}) as never
		);
		expect(await responseJson(valid)).toMatchObject({ autoOrganize: true });
		db.close();
	});

	test('task APIs expose active summaries and task detail lines', async () => {
		const db = await freshDb();
		const { enqueueTask } = await import('$lib/server/services/tasks');
		const { createTaskRecorder } = await import('$lib/server/services/task-recorder');
		const activeApi = await import('../../routes/api/tasks/active/+server');
		const detailApi = await import('../../routes/api/tasks/[id]/+server');

		const task = enqueueTask('scan_library_path', { libraryPathId: 'lib1' });
		createTaskRecorder(task.id).info('Library scan started: /tv');

		const active = await responseJson(
			await activeApi.GET(
				jsonEvent(
					{},
					`http://localhost/api/tasks/active?targetKey=${encodeURIComponent('libraryPath:lib1')}`
				) as never
			)
		);
		expect(active).toMatchObject([
			{
				id: task.id,
				targetKey: 'libraryPath:lib1',
				state: 'queued'
			}
		]);

		const detail = await responseJson(
			await detailApi.GET(jsonEvent({}, 'http://localhost/api/tasks/id', { id: task.id }) as never)
		);
		expect(detail).toMatchObject({
			task: { id: task.id, targetKey: 'libraryPath:lib1' },
			lines: [{ message: 'Library scan started: /tv' }]
		});
		db.close();
	});
});
