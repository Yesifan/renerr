import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const webdavSources = sqliteTable('webdav_sources', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	url: text('url').notNull(),
	username: text('username').notNull(),
	credentialEncrypted: text('credential_encrypted').notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const libraryPaths = sqliteTable('library_paths', {
	id: text('id').primaryKey(),
	sourceId: text('source_id').notNull(),
	path: text('path').notNull(),
	mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
	autoOrganize: integer('auto_organize', { mode: 'boolean' }).notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const libraryItems = sqliteTable(
	'library_items',
	{
		id: text('id').primaryKey(),
		libraryPathId: text('library_path_id').notNull(),
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
