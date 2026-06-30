import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDatabasePath } from '$lib/server/env';
import * as schema from './schema';

let database: Database.Database | undefined;

function getSqlite() {
	if (!database) {
		database = new Database(getDatabasePath());
		database.pragma('journal_mode = WAL');
		database.pragma('busy_timeout = 5000');
	}
	return database;
}

export function getDb() {
	return drizzle({ client: getSqlite(), schema });
}

export function closeDbForTest() {
	database?.close();
	database = undefined;
}
