import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createClient } from 'webdav';
import { WebDavFileClient } from './webdav-client';

const client = vi.hoisted(() => ({
	getDirectoryContents: vi.fn(),
	createDirectory: vi.fn(),
	moveFile: vi.fn(),
	deleteFile: vi.fn(),
	exists: vi.fn(),
	putFileContents: vi.fn()
}));

vi.mock('webdav', () => ({
	createClient: vi.fn(() => client)
}));

describe('WebDavFileClient', () => {
	beforeEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
		client.exists.mockResolvedValue(true);
		client.moveFile.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('uses the user provided URL as the WebDAV root', () => {
		new WebDavFileClient('https://alist.example.test/dav/quark/待整理影视', 'user', 'password');

		expect(createClient).toHaveBeenCalledWith('https://alist.example.test/dav/quark/待整理影视', {
			username: 'user',
			password: 'password'
		});
	});

	test('uses two steps for cross-directory rename', async () => {
		client.exists.mockResolvedValue(false);
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		const result = await webdav.moveFile(
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/新剧 (2026)/Season 01/新剧.2026.s01e01.mp4'
		);

		expect(result.steps).toEqual([
			{
				stage: 'rename_in_place',
				from: '/quark/待整理影视/旧剧/01.mp4',
				to: '/quark/待整理影视/旧剧/新剧.2026.s01e01.mp4',
				ok: true
			},
			{
				stage: 'move_to_target',
				from: '/quark/待整理影视/旧剧/新剧.2026.s01e01.mp4',
				to: '/quark/待整理影视/新剧 (2026)/Season 01/新剧.2026.s01e01.mp4',
				ok: true
			}
		]);
		expect(client.moveFile).toHaveBeenCalledTimes(2);
		expect(client.moveFile).toHaveBeenNthCalledWith(
			1,
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/旧剧/新剧.2026.s01e01.mp4',
			{ overwrite: false }
		);
		expect(client.moveFile).toHaveBeenNthCalledWith(
			2,
			'/quark/待整理影视/旧剧/新剧.2026.s01e01.mp4',
			'/quark/待整理影视/新剧 (2026)/Season 01/新剧.2026.s01e01.mp4',
			{ overwrite: false }
		);
	});

	test('uses a single MOVE when only the directory changes', async () => {
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		await webdav.moveFile('/quark/待整理影视/旧剧/01.mp4', '/quark/待整理影视/新剧/01.mp4');

		expect(client.moveFile).toHaveBeenCalledTimes(1);
		expect(client.moveFile).toHaveBeenCalledWith(
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/新剧/01.mp4',
			{
				overwrite: false
			}
		);
	});

	test('uses a single MOVE when only the basename changes', async () => {
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		await webdav.moveFile(
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/旧剧/新剧.2026.s01e01.mp4'
		);

		expect(client.moveFile).toHaveBeenCalledTimes(1);
		expect(client.moveFile).toHaveBeenCalledWith(
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/旧剧/新剧.2026.s01e01.mp4',
			{
				overwrite: false
			}
		);
	});

	test('waits for created directory visibility', async () => {
		vi.useFakeTimers();
		client.exists
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		const promise = webdav.ensureDirectory('/quark/待整理影视/新剧');
		await vi.advanceTimersByTimeAsync(300);
		await promise;

		expect(client.createDirectory).toHaveBeenCalledWith('/quark/待整理影视/新剧', {
			recursive: true
		});
		expect(client.exists).toHaveBeenCalledTimes(3);
	});

	test('surfaces transient WebDAV 500 move failures to the executor', async () => {
		client.moveFile.mockRejectedValue(new Error('Invalid response: 500 Internal Server Error'));
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		await expect(webdav.moveFile('/quark/旧剧/01.mp4', '/quark/新剧/01.mp4')).rejects.toThrow(
			'500 Internal Server Error'
		);

		expect(client.moveFile).toHaveBeenCalledTimes(1);
	});

	test('wraps same-directory rename stage failures', async () => {
		client.exists.mockResolvedValue(false);
		client.moveFile.mockRejectedValueOnce(new Error('rename denied'));
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		await expect(
			webdav.moveFile('/quark/旧剧/01.mp4', '/quark/新剧/新剧.2026.s01e01.mp4')
		).rejects.toMatchObject({
			name: 'FileMoveError',
			stage: 'rename_in_place',
			from: '/quark/旧剧/01.mp4',
			to: '/quark/旧剧/新剧.2026.s01e01.mp4',
			intermediate: '/quark/旧剧/新剧.2026.s01e01.mp4'
		});
	});

	test('wraps final move stage failures', async () => {
		client.exists.mockResolvedValue(false);
		client.moveFile
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('move denied'));
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		await expect(
			webdav.moveFile('/quark/旧剧/01.mp4', '/quark/新剧/新剧.2026.s01e01.mp4')
		).rejects.toMatchObject({
			name: 'FileMoveError',
			stage: 'move_to_target',
			from: '/quark/旧剧/新剧.2026.s01e01.mp4',
			to: '/quark/新剧/新剧.2026.s01e01.mp4',
			intermediate: '/quark/旧剧/新剧.2026.s01e01.mp4'
		});
	});
});
