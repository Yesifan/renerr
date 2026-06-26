import { createClient, type FileStat } from 'webdav';
import type { FileClient, FileEntry, MoveOptions, MoveResult } from './file-client';
import { basename, dirname, joinRemote } from '$lib/server/services/paths';

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
		const intermediate = intermediateMovePath(from, to);
		if (intermediate) {
			await this.client.moveFile(from, intermediate, { overwrite: false });
			await this.waitUntilExists(intermediate);
			await this.client.moveFile(intermediate, to, { overwrite: options.overwrite ?? false });
			return { ok: true };
		}
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

	private async waitUntilExists(path: string) {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			if (await this.client.exists(path)) return;
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
	}
}

function intermediateMovePath(from: string, to: string) {
	if (dirname(from) === dirname(to)) return null;
	if (basename(from) === basename(to)) return null;
	return joinRemote(dirname(to), basename(from));
}
