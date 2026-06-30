import { z } from 'zod';

export const mediaTypeSchema = z.enum(['movie', 'tv']);
export const itemStatusSchema = z.enum([
	'unidentified',
	'pending_review',
	'identified',
	'organized'
]);
export const taskStateSchema = z.enum(['queued', 'running', 'succeeded', 'partially_failed', 'failed']);

export const sourceNameSchema = z
	.string()
	.trim()
	.min(1)
	.refine((value) => value !== '.' && value !== '..', 'invalid_name')
	.refine((value) => !/[\\/:*?"<>|\u0000-\u001f]/.test(value), 'invalid_name');

export const webdavSourceInputSchema = z.object({
	name: sourceNameSchema,
	url: z.string().url(),
	username: z.string().trim().min(1),
	credential: z.string().optional()
});

export const libraryPathInputSchema = z.object({
	sourceId: z.string().min(1),
	path: z.string().trim().min(1),
	mediaType: mediaTypeSchema,
	autoOrganize: z.boolean().default(false)
});

export const libraryPathUpdateSchema = z
	.object({
		autoOrganize: z.boolean().optional()
	})
	.strict();

export const settingsSchema = z.object({
	tmdbApiKey: z.string().default(''),
	namingLanguage: z.string().default('zh-CN'),
	metadataEnabled: z.boolean().default(true),
	overwriteMetadata: z.boolean().default(false),
	logRetentionDays: z.number().int().min(1).max(365).default(30),
	movieFolderTemplate: z.string().default('{title} ({year})'),
	movieFileTemplate: z.string().default('{title}.{year}'),
	tvRootFolderTemplate: z.string().default('{title} ({year})'),
	seasonFolderTemplate: z.string().default('Season {season:00}'),
	tvEpisodeFileTemplate: z.string().default('{title}.{year}.s{season:00}e{episode:00}')
});

export const settingsPatchSchema = z
	.object({
		tmdbApiKey: z.string().optional(),
		namingLanguage: z.string().optional(),
		metadataEnabled: z.boolean().optional(),
		overwriteMetadata: z.boolean().optional(),
		logRetentionDays: z.number().int().min(1).max(365).optional(),
		movieFolderTemplate: z.string().optional(),
		movieFileTemplate: z.string().optional(),
		tvRootFolderTemplate: z.string().optional(),
		seasonFolderTemplate: z.string().optional(),
		tvEpisodeFileTemplate: z.string().optional()
	})
	.strict();

export const libraryItemsQuerySchema = z
	.object({
		libraryPathId: z.string().min(1).optional()
	})
	.strict();

export const navigationQuerySchema = z.object({}).strict();

export type AppSettings = z.infer<typeof settingsSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export type LibraryPathInput = z.infer<typeof libraryPathInputSchema>;
export type LibraryPathUpdate = z.infer<typeof libraryPathUpdateSchema>;
export type WebdavSourceInput = z.infer<typeof webdavSourceInputSchema>;
export type LibraryItemsQuery = z.infer<typeof libraryItemsQuerySchema>;

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
	mediaType: MediaType;
	autoOrganize: boolean;
};

export type TmdbResult = {
	id: number;
	title: string;
	originalTitle: string;
	year?: number;
	posterPath?: string;
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
	mediaKind: MediaType;
	sourceMediaId: string | null;
	title: string;
	originalTitle: string;
	year: number | null;
	posterPath: string | null;
	posterUrl: string | null;
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
