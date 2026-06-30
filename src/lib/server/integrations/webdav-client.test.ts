import { beforeEach, describe, expect, test, vi } from 'vitest';
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
		vi.clearAllMocks();
		client.exists.mockResolvedValue(true);
		client.moveFile.mockResolvedValue(undefined);
	});

	test('uses the user provided URL as the WebDAV root', () => {
		new WebDavFileClient('https://alist.example.test/dav/quark/待整理影视', 'user', 'password');

		expect(createClient).toHaveBeenCalledWith('https://alist.example.test/dav/quark/待整理影视', {
			username: 'user',
			password: 'password'
		});
	});

	test('splits cross-directory rename into move then same-directory rename for Alist compatibility', async () => {
		const webdav = new WebDavFileClient('https://alist.example.test/dav', 'user', 'password');

		await webdav.moveFile(
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/新剧 (2026)/Season 01/新剧.2026.s01e01.mp4'
		);

		expect(client.moveFile).toHaveBeenNthCalledWith(
			1,
			'/quark/待整理影视/旧剧/01.mp4',
			'/quark/待整理影视/新剧 (2026)/Season 01/01.mp4',
			{ overwrite: false }
		);
		expect(client.moveFile).toHaveBeenNthCalledWith(
			2,
			'/quark/待整理影视/新剧 (2026)/Season 01/01.mp4',
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
});
