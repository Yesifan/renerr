export type FileEntry = {
	basename: string;
	filename: string;
	type: 'file' | 'directory';
	size?: number;
	lastmod?: string;
};

export type MoveOptions = {
	overwrite?: boolean;
};

export type MoveResult = {
	ok: true;
};

export interface FileClient {
	listDirectory(path: string): Promise<FileEntry[]>;
	ensureDirectory(path: string): Promise<void>;
	moveFile(from: string, to: string, options?: MoveOptions): Promise<MoveResult>;
	deletePath(path: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	writeTextFile(path: string, content: string, overwrite?: boolean): Promise<void>;
}
