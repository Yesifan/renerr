import { and, asc, desc, eq, inArray, lt, notInArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { taskDetailLines, tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { getSettings } from './settings';

export type TaskDetailLineLevel = 'error' | 'warn' | 'info';

export function appendTaskDetailLine(input: {
	taskId: string;
	level: TaskDetailLineLevel;
	message: string;
}) {
	const row = {
		id: newId(),
		taskId: input.taskId,
		level: input.level,
		message: input.message,
		createdAt: nowIso()
	};
	getDb().insert(taskDetailLines).values(row).run();
	return row;
}

export function listTaskDetailLines(taskId: string, limit = 500) {
	return getDb()
		.select()
		.from(taskDetailLines)
		.where(eq(taskDetailLines.taskId, taskId))
		.orderBy(asc(taskDetailLines.createdAt))
		.limit(limit)
		.all();
}

export function cleanupTaskDetailLines(options: { maxRows?: number } = {}) {
	const settings = getSettings();
	const cutoff = new Date(
		Date.now() - settings.logRetentionDays * 24 * 60 * 60 * 1000
	).toISOString();
	const runningTaskIds = getDb()
		.select({ id: tasks.id })
		.from(tasks)
		.where(inArray(tasks.state, ['queued', 'running']))
		.all()
		.map((task) => task.id);
	const where = runningTaskIds.length
		? and(lt(taskDetailLines.createdAt, cutoff), notInArray(taskDetailLines.taskId, runningTaskIds))
		: lt(taskDetailLines.createdAt, cutoff);
	getDb().delete(taskDetailLines).where(where).run();
	pruneOldTaskDetailLines(options.maxRows ?? 10000, runningTaskIds);
}

function pruneOldTaskDetailLines(maxRows: number, protectedTaskIds: string[]) {
	if (maxRows <= 0) return;
	const where = protectedTaskIds.length
		? notInArray(taskDetailLines.taskId, protectedTaskIds)
		: undefined;
	const rows = getDb()
		.select({ id: taskDetailLines.id })
		.from(taskDetailLines)
		.where(where)
		.orderBy(desc(taskDetailLines.createdAt))
		.limit(maxRows + 1)
		.all();
	if (rows.length <= maxRows) return;
	const ids = rows.slice(maxRows).map((row) => row.id);
	if (!ids.length) return;
	getDb().delete(taskDetailLines).where(inArray(taskDetailLines.id, ids)).run();
}
