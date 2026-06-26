import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';

export function enqueueTask(type: string, payload: unknown) {
	const id = newId();
	getSqlite()
		.prepare(
			`insert into tasks (id, type, state, payload_json, created_at)
			 values (@id, @type, 'queued', @payloadJson, @createdAt)`
		)
		.run({ id, type, payloadJson: JSON.stringify(payload), createdAt: nowIso() });
	return getTask(id);
}

export function listTasks(limit = 100) {
	return (
		getSqlite()
		.prepare('select * from tasks order by created_at desc limit ?')
			.all(limit) as Record<string, unknown>[]
	).map(mapTask);
}

export function getTask(id: string) {
	const row = getSqlite().prepare('select * from tasks where id = ?').get(id);
	if (!row) throw new Error('Task not found');
	return mapTask(row as Record<string, unknown>);
}

export function failRunningTasksOnStartup() {
	getSqlite()
		.prepare(
			`update tasks set state = 'failed', error = 'Worker restarted while task was running', finished_at = ?
			 where state = 'running'`
		)
		.run(nowIso());
}

export function claimNextTask() {
	const db = getSqlite();
	const task = db.prepare("select * from tasks where state = 'queued' order by created_at limit 1").get() as
		| Record<string, unknown>
		| undefined;
	if (!task) return null;
	const result = db
		.prepare("update tasks set state = 'running', started_at = ? where id = ? and state = 'queued'")
		.run(nowIso(), task.id);
	return result.changes ? mapTask({ ...task, state: 'running', started_at: nowIso() }) : null;
}

export function finishTask(id: string, state: 'succeeded' | 'partially_failed' | 'failed', error?: string) {
	getSqlite()
		.prepare('update tasks set state = ?, error = ?, finished_at = ? where id = ?')
		.run(state, error || null, nowIso(), id);
}

export function updateTaskProgress(id: string, progress: unknown) {
	getSqlite()
		.prepare('update tasks set progress_json = ? where id = ?')
		.run(JSON.stringify(progress), id);
}

function mapTask(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		type: String(row.type),
		state: String(row.state),
		payload: JSON.parse(String(row.payload_json || '{}')),
		progress: row.progress_json ? JSON.parse(String(row.progress_json)) : null,
		error: row.error ? String(row.error) : null,
		createdAt: String(row.created_at),
		startedAt: row.started_at ? String(row.started_at) : null,
		finishedAt: row.finished_at ? String(row.finished_at) : null
	};
}
