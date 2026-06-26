import { z } from 'zod';

export const mediaTypeSchema = z.enum(['movie', 'tv']);
export const itemStatusSchema = z.enum([
	'unidentified',
	'pending_review',
	'identified',
	'organized',
	'failed'
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

export type AppSettings = z.infer<typeof settingsSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
