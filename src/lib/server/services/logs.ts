import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';

export type LogLevel = 'error' | 'warn' | 'info';

export function log(level: LogLevel, component: string, message: string, context: unknown = {}) {
	getSqlite()
		.prepare(
			`insert into logs (id, time, level, component, message, context_json)
			 values (@id, @time, @level, @component, @message, @contextJson)`
		)
		.run({
			id: newId(),
			time: nowIso(),
			level,
			component,
			message,
			contextJson: JSON.stringify(context)
		});
}

export function listLogs(limit = 200) {
	return (
		getSqlite().prepare('select * from logs order by time desc limit ?').all(limit) as Record<
			string,
			unknown
		>[]
	).map(mapRow);
}

export function clearLogs() {
	getSqlite().prepare('delete from logs').run();
}

function mapRow(row: Record<string, unknown>) {
	return {
		id: row.id,
		time: row.time,
		level: row.level,
		component: row.component,
		message: row.message,
		context: JSON.parse(String(row.context_json || '{}'))
	};
}
