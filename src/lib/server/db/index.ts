import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDatabasePath } from '$lib/server/env';
import * as schema from './schema';

let database: Database.Database | undefined;

export function getSqlite() {
	if (!database) {
		database = new Database(getDatabasePath());
		database.pragma('journal_mode = WAL');
		database.pragma('busy_timeout = 5000');
		migrate(database);
	}
	return database;
}

export function getDb() {
	return drizzle(getSqlite(), { schema });
}

function migrate(db: Database.Database) {
	db.exec(`
		create table if not exists webdav_sources (
			id text primary key,
			name text not null unique,
			url text not null,
			username text not null,
			credential_encrypted text not null,
			created_at text not null,
			updated_at text not null
		);
		create table if not exists library_paths (
			id text primary key,
			source_id text not null references webdav_sources(id) on delete cascade,
			path text not null,
			media_type text not null check (media_type in ('movie', 'tv')),
			auto_organize integer not null default 0,
			created_at text not null,
			updated_at text not null,
			unique(source_id, path)
		);
		create table if not exists library_items (
			id text primary key,
			library_path_id text not null references library_paths(id) on delete cascade,
			kind text not null check (kind in ('folder', 'file')),
			top_level_path text not null,
			status text not null,
			source text,
			source_media_type text,
			source_media_id text,
			title text,
			original_title text,
			year integer,
			poster_path text,
			confidence text,
			review_reason text,
			recognition_candidates_json text,
			video_file_count integer not null default 0,
			compliant_file_count integer not null default 0,
			non_compliant_file_count integer not null default 0,
			unknown_file_count integer not null default 0,
			last_scanned_at text,
			last_inspected_at text,
			last_execution_summary_json text,
			created_at text not null,
			updated_at text not null,
			unique(library_path_id, top_level_path)
		);
		create table if not exists app_settings (
			id text primary key,
			value_json text not null,
			updated_at text not null
		);
		create table if not exists rename_plan_drafts (
			id text primary key,
			library_path_id text not null,
			library_item_id text,
			mode text not null,
			status text not null,
			rows_json text not null,
			created_at text not null,
			updated_at text not null,
			expires_at text not null
		);
		create table if not exists rename_plans (
			id text primary key,
			library_path_id text not null,
			mode text not null,
			status text not null,
			template_snapshot_json text not null,
			created_by text not null,
			confirmed_at text,
			created_at text not null
		);
		create table if not exists rename_plan_items (
			id text primary key,
			plan_id text not null,
			library_item_id text not null,
			source_file_path text not null,
			target_file_path text not null,
			target_top_level_path text not null,
			media_kind text not null,
			source_media_id text,
			season integer,
			episode integer,
			overwrite integer not null default 0,
			sidecars_json text not null default '[]',
			status text not null
		);
		create table if not exists tasks (
			id text primary key,
			type text not null,
			state text not null,
			payload_json text not null,
			progress_json text,
			error text,
			created_at text not null,
			started_at text,
			finished_at text
		);
		create table if not exists execution_records (
			id text primary key,
			task_id text not null,
			plan_item_id text,
			source_path text not null,
			target_path text not null,
			status text not null,
			error text,
			context_json text not null default '{}',
			created_at text not null
		);
		create table if not exists logs (
			id text primary key,
			time text not null,
			level text not null,
			component text not null,
			message text not null,
			context_json text not null default '{}'
		);
	`);
	db.exec(`
		update library_items
		set status = 'identified', updated_at = datetime('now')
		where status = 'failed' and source_media_id is not null;

		update library_items
		set status = 'pending_review',
			review_reason = coalesce(review_reason, 'legacy_failed'),
			recognition_candidates_json = coalesce(recognition_candidates_json, '[]'),
			updated_at = datetime('now')
		where status = 'failed' and source_media_id is null;
	`);
}
