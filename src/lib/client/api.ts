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
	title: string | null;
	year: number | null;
	posterUrl: string | null;
	videoFileCount: number;
	reviewReason: string | null;
	recognitionCandidates: TmdbResult[];
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
	if (!response.ok) throw new Error(data.error || response.statusText);
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
	const labels: Record<string, string> = {
		unidentified: '未识别',
		pending_review: reason ? `待确认 · ${reason}` : '待确认',
		identified: '已识别',
		organized: '已整理',
		failed: '失败',
		queued: '排队中',
		running: '运行中',
		succeeded: '成功',
		partially_failed: '部分失败'
	};
	return labels[status] || status;
}

export function statusClass(status: string) {
	if (status === 'failed') return 'bg-red-500/15 text-red-300';
	if (status === 'pending_review' || status === 'partially_failed') return 'bg-amber-500/15 text-amber-300';
	if (status === 'identified' || status === 'running') return 'bg-sky-500/15 text-sky-300';
	if (status === 'organized' || status === 'succeeded') return 'bg-emerald-500/15 text-emerald-300';
	return 'bg-slate-500/15 text-slate-300';
}
