import { createClient, type FileStat } from 'webdav';
import type { FileClient, FileEntry, MoveOptions, MoveResult } from './file-client';

export class WebDavFileClient implements FileClient {
	private client;

	constructor(url: string, username: string, password: string) {
		this.client = createClient(url, { username, password });
	}

	async listDirectory(path: string): Promise<FileEntry[]> {
		const result = (await this.client.getDirectoryContents(path)) as FileStat[] | { data: FileStat[] };
		const entries = Array.isArray(result) ? result : result.data;
		return (entries as FileStat[]).map((entry) => ({
			basename: entry.basename,
			filename: entry.filename,
			type: entry.type === 'directory' ? 'directory' : 'file',
			size: typeof entry.size === 'number' ? entry.size : undefined,
			lastmod: entry.lastmod
		}));
	}

	async ensureDirectory(path: string): Promise<void> {
		if (await this.exists(path)) return;
		await this.client.createDirectory(path, { recursive: true });
	}

	async moveFile(from: string, to: string, options: MoveOptions = {}): Promise<MoveResult> {
		await this.client.moveFile(from, to, { overwrite: options.overwrite ?? false });
		return { ok: true };
	}

	async deletePath(path: string): Promise<void> {
		await this.client.deleteFile(path);
	}

	async exists(path: string): Promise<boolean> {
		return this.client.exists(path);
	}

	async writeTextFile(path: string, content: string, overwrite = false): Promise<void> {
		if (!overwrite && (await this.exists(path))) return;
		await this.client.putFileContents(path, content, { overwrite });
	}
}
