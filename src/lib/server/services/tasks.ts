import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';

export function enqueueTask(type: string, payload: unknown) {
	const id = newId();
	getDb()
		.insert(tasks)
		.values({
			id,
			type,
			state: 'queued',
			payloadJson: JSON.stringify(payload),
			createdAt: nowIso()
		})
		.run();
	return getTask(id);
}

export function listTasks(limit = 100) {
	return getDb()
		.select()
		.from(tasks)
		.orderBy(desc(tasks.createdAt))
		.limit(limit)
		.all()
		.map(mapTask);
}

export function getTask(id: string) {
	const row = getDb().select().from(tasks).where(eq(tasks.id, id)).get();
	if (!row) throw new Error('Task not found');
	return mapTask(row);
}

export function failRunningTasksOnStartup() {
	getDb()
		.update(tasks)
		.set({
			state: 'failed',
			error: 'Worker restarted while task was running',
			finishedAt: nowIso()
		})
		.where(eq(tasks.state, 'running'))
		.run();
}

export function claimNextTask() {
	const db = getDb();
	const task = db
		.select()
		.from(tasks)
		.where(eq(tasks.state, 'queued'))
		.orderBy(asc(tasks.createdAt))
		.limit(1)
		.get();
	if (!task) return null;
	const startedAt = nowIso();
	const result = db
		.update(tasks)
		.set({ state: 'running', startedAt })
		.where(and(eq(tasks.id, task.id), eq(tasks.state, 'queued')))
		.run();
	return result.changes ? mapTask({ ...task, state: 'running', startedAt }) : null;
}

export function finishTask(
	id: string,
	state: 'succeeded' | 'partially_failed' | 'failed',
	error?: string
) {
	getDb()
		.update(tasks)
		.set({ state, error: error || null, finishedAt: nowIso() })
		.where(eq(tasks.id, id))
		.run();
}

export function updateTaskProgress(id: string, progress: unknown) {
	getDb()
		.update(tasks)
		.set({ progressJson: JSON.stringify(progress) })
		.where(eq(tasks.id, id))
		.run();
}

function mapTask(row: typeof tasks.$inferSelect) {
	return {
		id: row.id,
		type: row.type,
		state: row.state,
		payload: JSON.parse(row.payloadJson || '{}'),
		progress: row.progressJson ? JSON.parse(row.progressJson) : null,
		error: row.error,
		createdAt: row.createdAt,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt
	};
}
