import { errorLabel, statusLabel } from '$lib/i18n';

export type ApiErrorDto = {
	code: string;
	message: string;
	context?: unknown;
};

export class ClientApiError extends Error {
	code: string;
	safeMessage: string;
	context?: unknown;

	constructor(dto: ApiErrorDto) {
		super(errorLabel(dto.code, dto.message));
		this.name = 'ClientApiError';
		this.code = dto.code;
		this.safeMessage = dto.message;
		this.context = dto.context;
	}
}

export type Workspace = {
	sources: Source[];
	libraries: Library[];
	items: Item[];
	tasks: Task[];
	settings: PublicSettings;
};

export type PublicSettings = {
	tmdbApiKey: string;
	namingLanguage?: string;
	metadataEnabled?: boolean;
	overwriteMetadata?: boolean;
	logRetentionDays?: number;
};

export type Source = {
	id: string;
	name: string;
	url: string;
	username: string;
};

export type Library = {
	id: string;
	sourceId: string;
	sourceName: string;
	path: string;
	mediaType: 'movie' | 'tv';
	autoOrganize: boolean;
};

export type Item = {
	id: string;
	libraryPathId: string;
	kind: 'folder' | 'file';
	topLevelPath: string;
	status: string;
	source: string | null;
	sourceMediaType: string | null;
	sourceMediaId: string | null;
	title: string | null;
	year: number | null;
	posterUrl: string | null;
	videoFileCount: number;
	reviewReason: string | null;
	recognitionCandidates: TmdbResult[];
	compliantFileCount?: number;
	nonCompliantFileCount?: number;
	lastScannedAt?: string | null;
	lastExecutionSummary?: unknown;
};

export type ItemDetail = {
	item: Item;
	library: Library;
	files: ItemDetailFile[];
	summary: {
		videoFileCount: number;
		compliantFileCount?: number;
		nonCompliantFileCount?: number;
		lastScannedAt?: string | null;
		lastExecutionSummary?: unknown;
	};
	executionRecords: ExecutionRecord[];
};

export type ItemDetailFile = {
	path: string;
	basename: string;
	type: 'file' | 'directory';
	size?: number;
	lastmod?: string;
	video: boolean;
	compliance: { state: 'not_video' | 'compliant' | 'non_compliant'; movie?: unknown; tv?: unknown };
};

export type ExecutionRecord = {
	id: string;
	sourcePath: string;
	targetPath: string;
	status: string;
	error: string | null;
	context: unknown;
	createdAt: string;
};

export type RenamePlanDraft = {
	id: string;
	libraryPathId: string;
	libraryItemId: string | null;
	mode: string;
	status: string;
	rows: RenamePlanDraftRow[];
	createdAt: string;
	updatedAt: string;
	expiresAt: string;
};

export type RenamePlanDraftRow = {
	id: string;
	selected: boolean;
	sourceFilePath: string;
	targetFilePath: string;
	targetTopLevelPath: string;
	mediaKind: 'movie' | 'tv';
	sourceMediaId: string | null;
	season: number | null;
	episode: number | null;
	overwrite: boolean;
	conflict: boolean;
	conflictAction: 'overwrite' | null;
	sidecars: string[];
	status: 'valid' | 'invalid';
	errorCode: string | null;
};

export type Task = {
	id: string;
	type: string;
	state: string;
	error: string | null;
	createdAt: string;
	startedAt: string | null;
	finishedAt: string | null;
};

export type LogEntry = {
	id: string;
	time: string;
	level: string;
	component: string;
	message: string;
	context: unknown;
};

export type TmdbResult = {
	id: number;
	title: string;
	originalTitle: string;
	year?: number;
	posterPath?: string;
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	const data = await response.json();
	if (!response.ok) {
		const dto: ApiErrorDto = {
			code: typeof data?.code === 'string' ? data.code : 'unknown',
			message: typeof data?.message === 'string' ? data.message : response.statusText,
			context: data?.context
		};
		throw new ClientApiError(dto);
	}
	return data;
}

export function post<T = unknown>(url: string, payload: unknown = {}) {
	return api<T>(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}

export function put<T = unknown>(url: string, payload: unknown = {}) {
	return api<T>(url, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}

export function libraryLabel(library: Library) {
	return `/${library.sourceName}${library.path}`;
}

export function statusText(status: string, reason: string | null = null) {
	return statusLabel(status, reason);
}

export function statusClass(status: string) {
	if (status === 'failed') return 'bg-red-500/15 text-red-300';
	if (status === 'pending_review' || status === 'partially_failed') return 'bg-amber-500/15 text-amber-300';
	if (status === 'identified' || status === 'running') return 'bg-sky-500/15 text-sky-300';
	if (status === 'organized' || status === 'succeeded') return 'bg-emerald-500/15 text-emerald-300';
	return 'bg-slate-500/15 text-slate-300';
}
