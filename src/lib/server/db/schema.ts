import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const webdavSources = sqliteTable('webdav_sources', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	url: text('url').notNull(),
	username: text('username').notNull(),
	credentialEncrypted: text('credential_encrypted').notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const libraryPaths = sqliteTable(
	'library_paths',
	{
		id: text('id').primaryKey(),
		sourceId: text('source_id')
			.notNull()
			.references(() => webdavSources.id, { onDelete: 'cascade' }),
		path: text('path').notNull(),
		mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
		autoOrganize: integer('auto_organize', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [uniqueIndex('library_path_identity').on(table.sourceId, table.path)]
);

export const libraryItems = sqliteTable(
	'library_items',
	{
		id: text('id').primaryKey(),
		libraryPathId: text('library_path_id')
			.notNull()
			.references(() => libraryPaths.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['folder', 'file'] }).notNull(),
		topLevelPath: text('top_level_path').notNull(),
		status: text('status').notNull(),
		source: text('source'),
		sourceMediaType: text('source_media_type'),
		sourceMediaId: text('source_media_id'),
		title: text('title'),
		originalTitle: text('original_title'),
		year: integer('year'),
		posterPath: text('poster_path'),
		confidence: text('confidence'),
		reviewReason: text('review_reason'),
		recognitionCandidatesJson: text('recognition_candidates_json'),
		videoFileCount: integer('video_file_count').notNull(),
		compliantFileCount: integer('compliant_file_count').notNull(),
		nonCompliantFileCount: integer('non_compliant_file_count').notNull(),
		unknownFileCount: integer('unknown_file_count').notNull(),
		lastScannedAt: text('last_scanned_at'),
		lastInspectedAt: text('last_inspected_at'),
		lastExecutionSummaryJson: text('last_execution_summary_json'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [uniqueIndex('library_item_identity').on(table.libraryPathId, table.topLevelPath)]
);

export const appSettings = sqliteTable('app_settings', {
	id: text('id').primaryKey(),
	valueJson: text('value_json').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const renamePlanDrafts = sqliteTable('rename_plan_drafts', {
	id: text('id').primaryKey(),
	libraryPathId: text('library_path_id').notNull(),
	libraryItemId: text('library_item_id'),
	mode: text('mode').notNull(),
	status: text('status').notNull(),
	rowsJson: text('rows_json').notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	expiresAt: text('expires_at').notNull()
});

export const renamePlans = sqliteTable('rename_plans', {
	id: text('id').primaryKey(),
	libraryPathId: text('library_path_id').notNull(),
	mode: text('mode').notNull(),
	status: text('status').notNull(),
	templateSnapshotJson: text('template_snapshot_json').notNull(),
	createdBy: text('created_by').notNull(),
	confirmedAt: text('confirmed_at'),
	createdAt: text('created_at').notNull()
});

export const renamePlanItems = sqliteTable('rename_plan_items', {
	id: text('id').primaryKey(),
	planId: text('plan_id').notNull(),
	libraryItemId: text('library_item_id').notNull(),
	sourceFilePath: text('source_file_path').notNull(),
	targetFilePath: text('target_file_path').notNull(),
	targetTopLevelPath: text('target_top_level_path').notNull(),
	mediaKind: text('media_kind', { enum: ['movie', 'tv'] }).notNull(),
	sourceMediaId: text('source_media_id'),
	season: integer('season'),
	episode: integer('episode'),
	overwrite: integer('overwrite', { mode: 'boolean' }).notNull().default(false),
	sidecarsJson: text('sidecars_json').notNull().default('[]'),
	status: text('status').notNull()
});

export const tasks = sqliteTable(
	'tasks',
	{
		id: text('id').primaryKey(),
		type: text('type').notNull(),
		targetKey: text('target_key').notNull().default(''),
		targetLabel: text('target_label'),
		state: text('state').notNull(),
		payloadJson: text('payload_json').notNull(),
		progressJson: text('progress_json'),
		resultSummaryJson: text('result_summary_json'),
		error: text('error'),
		createdAt: text('created_at').notNull(),
		startedAt: text('started_at'),
		finishedAt: text('finished_at')
	},
	(table) => [
		index('task_active_target').on(table.type, table.targetKey, table.state),
		index('task_created_at').on(table.createdAt)
	]
);

export const executionRecords = sqliteTable(
	'execution_records',
	{
		id: text('id').primaryKey(),
		taskId: text('task_id').notNull(),
		planItemId: text('plan_item_id'),
		sourcePath: text('source_path').notNull(),
		targetPath: text('target_path').notNull(),
		status: text('status').notNull(),
		error: text('error'),
		contextJson: text('context_json').notNull().default('{}'),
		createdAt: text('created_at').notNull()
	},
	(table) => [
		index('execution_record_task').on(table.taskId, table.createdAt),
		index('execution_record_created_at').on(table.createdAt)
	]
);

export const logs = sqliteTable(
	'logs',
	{
		id: text('id').primaryKey(),
		taskId: text('task_id'),
		time: text('time').notNull(),
		level: text('level', { enum: ['error', 'warn', 'info'] }).notNull(),
		component: text('component').notNull(),
		message: text('message').notNull(),
		contextJson: text('context_json').notNull().default('{}')
	},
	(table) => [index('log_task').on(table.taskId, table.time), index('log_time').on(table.time)]
);
