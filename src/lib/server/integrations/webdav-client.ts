import { createClient, type FileStat } from 'webdav';
import { basename, dirname, joinRemote } from '$lib/server/services/paths';
import {
	FileMoveError,
	type FileClient,
	type FileEntry,
	type MoveOptions,
	type MoveResult,
	type MoveStage,
	type MoveStep
} from './file-client';

export class WebDavFileClient implements FileClient {
	private client;

	constructor(url: string, username: string, password: string) {
		this.client = createClient(url, { username, password });
	}

	async listDirectory(path: string): Promise<FileEntry[]> {
		const result = (await this.client.getDirectoryContents(path)) as
			FileStat[] | { data: FileStat[] };
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
		if (!(await this.waitUntilExists(path))) {
			throw new Error(`Directory was not visible after creation: ${path}`);
		}
	}

	async moveFile(from: string, to: string, options: MoveOptions = {}): Promise<MoveResult> {
		const steps: MoveStep[] = [];
		const fromDir = dirname(from);
		const toDir = dirname(to);
		const fromName = basename(from);
		const toName = basename(to);
		if (fromDir !== toDir && fromName !== toName) {
			const intermediate = joinRemote(fromDir, toName);
			const warnings: Record<string, unknown>[] = [];
			if (await this.exists(intermediate)) {
				warnings.push({
					type: 'resumed_intermediate_move',
					originalSource: from,
					intermediate,
					finalTarget: to
				});
			} else {
				await this.moveStep('rename_in_place', from, intermediate, false, steps, {
					intermediate
				});
			}
			await this.moveStep('move_to_target', intermediate, to, options.overwrite ?? false, steps, {
				intermediate
			});
			return { ok: true, steps, warnings: warnings.length ? warnings : undefined };
		}
		await this.moveStep('direct_move', from, to, options.overwrite ?? false, steps);
		return { ok: true, steps };
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

	private async moveStep(
		stage: MoveStage,
		from: string,
		to: string,
		overwrite: boolean,
		steps: MoveStep[],
		context: { intermediate?: string; finalTarget?: string; originalSource?: string } = {}
	) {
		try {
			await this.client.moveFile(from, to, { overwrite });
			steps.push({ stage, from, to, ok: true });
		} catch (error) {
			throw new FileMoveError({
				stage,
				from,
				to,
				intermediate: context.intermediate,
				cause: error,
				message: `${stage} failed: ${from} -> ${to}: ${String(error)}`
			});
		}
	}

	private async waitUntilExists(path: string) {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			if (await this.client.exists(path)) return true;
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
		return false;
	}
}
