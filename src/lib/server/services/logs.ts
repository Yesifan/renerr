import { and, asc, desc, eq, inArray, isNull, lt, notInArray, or } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { executionRecords, logs, tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { getSettings } from './settings';

export type LogLevel = 'error' | 'warn' | 'info';

export function log(level: LogLevel, component: string, message: string, context: unknown = {}) {
	const safeContext = boundContext(context);
	getDb()
		.insert(logs)
		.values({
			id: newId(),
			taskId: taskIdFromContext(safeContext),
			time: nowIso(),
			level,
			component,
			message,
			contextJson: JSON.stringify(safeContext)
		})
		.run();
}

export function listLogs(limit = 200) {
	return getDb()
		.select({
			log: logs,
			taskType: tasks.type,
			taskTargetLabel: tasks.targetLabel
		})
		.from(logs)
		.leftJoin(tasks, eq(tasks.id, logs.taskId))
		.orderBy(desc(logs.time))
		.limit(limit)
		.all()
		.map((row) =>
			mapRow(row.log, { taskType: row.taskType, taskTargetLabel: row.taskTargetLabel })
		);
}

export function listLogsForTask(taskId: string, limit = 200) {
	return getDb()
		.select()
		.from(logs)
		.where(eq(logs.taskId, taskId))
		.orderBy(asc(logs.time))
		.limit(limit)
		.all()
		.map((row) => mapRow(row));
}

export function clearLogs() {
	getDb().delete(logs).run();
}

export function cleanupTaskObservability(options: { maxLogRows?: number; maxExecutionRows?: number } = {}) {
	const settings = getSettings();
	const cutoff = new Date(Date.now() - settings.logRetentionDays * 24 * 60 * 60 * 1000).toISOString();
	const runningTaskIds = getDb()
		.select({ id: tasks.id })
		.from(tasks)
		.where(inArray(tasks.state, ['queued', 'running']))
		.all()
		.map((task) => task.id);
	const canCleanLog = runningTaskIds.length
		? or(isNull(logs.taskId), notInArray(logs.taskId, runningTaskIds))
		: undefined;
	getDb()
		.delete(logs)
		.where(canCleanLog ? and(lt(logs.time, cutoff), canCleanLog) : lt(logs.time, cutoff))
		.run();
	pruneOldRows('logs', options.maxLogRows ?? 10000, runningTaskIds);
	pruneOldRows('execution_records', options.maxExecutionRows ?? 10000, runningTaskIds);
}

function mapRow(
	row: typeof logs.$inferSelect,
	task: { taskType?: string | null; taskTargetLabel?: string | null } = {}
) {
	const context = JSON.parse(row.contextJson || '{}');
	return {
		id: row.id,
		taskId: row.taskId,
		taskType: task.taskType ?? null,
		taskTargetLabel: task.taskTargetLabel ?? null,
		time: row.time,
		level: row.level,
		component: row.component,
		message: row.message,
		summary: typeof context?.summary === 'string' ? context.summary : null,
		context
	};
}

function taskIdFromContext(context: unknown) {
	if (!context || typeof context !== 'object') return null;
	const value = (context as { taskId?: unknown }).taskId;
	return typeof value === 'string' && value ? value : null;
}

function boundContext(context: unknown) {
	const json = JSON.stringify(context ?? {});
	if (json.length <= 4000) return context ?? {};
	return {
		summary:
			context && typeof context === 'object'
				? String((context as { summary?: unknown }).summary ?? 'Context truncated')
				: 'Context truncated',
		truncated: true
	};
}

function pruneOldRows(tableName: 'logs' | 'execution_records', maxRows: number, protectedTaskIds: string[]) {
	if (maxRows <= 0) return;
	const table = tableName === 'logs' ? logs : executionRecords;
	const where =
		protectedTaskIds.length && 'taskId' in table
			? or(isNull(table.taskId), notInArray(table.taskId, protectedTaskIds))
			: undefined;
	const rows = getDb()
		.select({ id: table.id })
		.from(table)
		.where(where)
		.orderBy(desc(tableName === 'logs' ? logs.time : executionRecords.createdAt))
		.limit(maxRows + 1)
		.all();
	if (rows.length <= maxRows) return;
	const ids = rows.slice(maxRows).map((row) => row.id);
	if (!ids.length) return;
	getDb().delete(table).where(inArray(table.id, ids)).run();
}
