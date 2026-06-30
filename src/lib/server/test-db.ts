import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { closeDbForTest, getDb } from './db';
import { getDatabasePath } from './env';

let testSqlite: Database.Database | undefined;

export function pushCurrentSchemaForTest() {
	execFileSync('pnpm', ['run', 'db:push', '--force'], {
		cwd: process.cwd(),
		env: process.env,
		stdio: 'pipe'
	});
}

export function getTestDb() {
	return getDb();
}

export function getSqliteForTest() {
	if (!testSqlite) {
		testSqlite = new Database(getDatabasePath());
		testSqlite.pragma('journal_mode = WAL');
		testSqlite.pragma('busy_timeout = 5000');
		const close = testSqlite.close.bind(testSqlite);
		testSqlite.close = () => {
			const closed = close();
			testSqlite = undefined;
			closeDbForTest();
			return closed;
		};
	}
	return testSqlite;
}

export function closeTestDb() {
	testSqlite?.close();
	testSqlite = undefined;
	closeDbForTest();
}
