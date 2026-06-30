import { desc } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { logs } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';

export type LogLevel = 'error' | 'warn' | 'info';

export function log(level: LogLevel, component: string, message: string, context: unknown = {}) {
	getDb()
		.insert(logs)
		.values({
			id: newId(),
			time: nowIso(),
			level,
			component,
			message,
			contextJson: JSON.stringify(context)
		})
		.run();
}

export function listLogs(limit = 200) {
	return getDb().select().from(logs).orderBy(desc(logs.time)).limit(limit).all().map(mapRow);
}

export function clearLogs() {
	getDb().delete(logs).run();
}

function mapRow(row: typeof logs.$inferSelect) {
	return {
		id: row.id,
		time: row.time,
		level: row.level,
		component: row.component,
		message: row.message,
		context: JSON.parse(row.contextJson || '{}')
	};
}
