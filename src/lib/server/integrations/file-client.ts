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

export type MoveStage = 'direct_move' | 'rename_in_place' | 'move_to_target';

export type MoveStep = {
	stage: MoveStage;
	from: string;
	to: string;
	ok: true;
};

export type MoveResult = {
	ok: true;
	steps?: MoveStep[];
	warnings?: Record<string, unknown>[];
};

export class FileMoveError extends Error {
	stage: MoveStage;
	from: string;
	to: string;
	intermediate?: string;
	cause?: unknown;

	constructor(input: {
		stage: MoveStage;
		from: string;
		to: string;
		intermediate?: string;
		cause?: unknown;
		message?: string;
	}) {
		super(input.message ?? `File move failed during ${input.stage}: ${input.from} -> ${input.to}`);
		this.name = 'FileMoveError';
		this.stage = input.stage;
		this.from = input.from;
		this.to = input.to;
		this.intermediate = input.intermediate;
		this.cause = input.cause;
	}
}

export interface FileClient {
	listDirectory(path: string): Promise<FileEntry[]>;
	ensureDirectory(path: string): Promise<void>;
	moveFile(from: string, to: string, options?: MoveOptions): Promise<MoveResult>;
	deletePath(path: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	writeTextFile(path: string, content: string, overwrite?: boolean): Promise<void>;
}
