import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { executionRecords, tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { listLogsForTask } from './logs';

export type TaskType = 'scan_library_path' | 'scan_library_item' | 'execute_rename_plan';

type TaskPayload = {
	libraryPathId?: unknown;
	libraryItemId?: unknown;
	planId?: unknown;
};

type EnqueueOptions = {
	targetLabel?: string | null;
};

export function taskTargetKey(type: string, payload: unknown) {
	const data = (payload ?? {}) as TaskPayload;
	if (type === 'scan_library_path') return `libraryPath:${String(data.libraryPathId ?? '')}`;
	if (type === 'scan_library_item') return `libraryItem:${String(data.libraryItemId ?? '')}`;
	if (type === 'execute_rename_plan') return `renamePlan:${String(data.planId ?? '')}`;
	return `${type}:${JSON.stringify(payload ?? {})}`;
}

export function enqueueTask(type: TaskType, payload: TaskPayload, options: EnqueueOptions = {}) {
	const id = newId();
	const targetKey = taskTargetKey(type, payload);
	const existing = findActiveTask(type, targetKey);
	if (existing) return existing;
	getDb()
		.insert(tasks)
		.values({
			id,
			type,
			targetKey,
			targetLabel: options.targetLabel ?? defaultTargetLabel(type, payload),
			state: 'queued',
			payloadJson: JSON.stringify(payload),
			createdAt: nowIso()
		})
		.run();
	return getTask(id);
}

function findActiveTask(type: string, targetKey: string) {
	const row = getDb()
		.select()
		.from(tasks)
		.where(and(eq(tasks.type, type), eq(tasks.targetKey, targetKey), inArray(tasks.state, activeStates)))
		.orderBy(asc(tasks.createdAt))
		.limit(1)
		.get();
	return row ? mapTask(row) : null;
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

export function listActiveTasks(targetKeys?: string[]) {
	const where = targetKeys?.length
		? and(inArray(tasks.state, activeStates), inArray(tasks.targetKey, targetKeys))
		: inArray(tasks.state, activeStates);
	return getDb()
		.select()
		.from(tasks)
		.where(where)
		.orderBy(desc(tasks.createdAt))
		.all()
		.map(mapActiveTask);
}

export function getTask(id: string) {
	const row = getDb().select().from(tasks).where(eq(tasks.id, id)).get();
	if (!row) throw new Error('Task not found');
	return mapTask(row);
}

export function getTaskDetail(id: string) {
	const task = getTask(id);
	const records =
		task.type === 'execute_rename_plan'
			? getDb()
					.select()
					.from(executionRecords)
					.where(eq(executionRecords.taskId, id))
					.orderBy(desc(executionRecords.createdAt))
					.limit(200)
					.all()
					.map(mapExecutionRecord)
			: [];
	return {
		task,
		logs: listLogsForTask(id),
		executionRecords: records,
		detailsCleaned: false
	};
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
	error?: string,
	resultSummary?: unknown
) {
	const values: {
		state: 'succeeded' | 'partially_failed' | 'failed';
		error: string | null;
		finishedAt: string;
		resultSummaryJson?: string;
	} = {
		state,
		error: error || null,
		finishedAt: nowIso()
	};
	if (resultSummary) values.resultSummaryJson = JSON.stringify(resultSummary);
	getDb()
		.update(tasks)
		.set(values)
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

function defaultTargetLabel(type: string, payload: TaskPayload) {
	if (type === 'scan_library_path') return String(payload.libraryPathId ?? '');
	if (type === 'scan_library_item') return String(payload.libraryItemId ?? '');
	if (type === 'execute_rename_plan') return String(payload.planId ?? '');
	return null;
}

function mapTask(row: typeof tasks.$inferSelect) {
	return {
		id: row.id,
		type: row.type,
		targetKey: row.targetKey,
		targetLabel: row.targetLabel,
		state: row.state,
		payload: JSON.parse(row.payloadJson || '{}'),
		progress: row.progressJson ? JSON.parse(row.progressJson) : null,
		resultSummary: row.resultSummaryJson ? JSON.parse(row.resultSummaryJson) : null,
		error: row.error,
		createdAt: row.createdAt,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt
	};
}

function mapActiveTask(row: typeof tasks.$inferSelect) {
	const task = mapTask(row);
	return {
		id: task.id,
		type: task.type,
		targetKey: task.targetKey,
		targetLabel: task.targetLabel,
		state: task.state,
		payload: task.payload,
		progress: task.progress,
		createdAt: task.createdAt,
		startedAt: task.startedAt
	};
}

function mapExecutionRecord(row: typeof executionRecords.$inferSelect) {
	return {
		id: row.id,
		taskId: row.taskId,
		planItemId: row.planItemId,
		sourcePath: row.sourcePath,
		targetPath: row.targetPath,
		status: row.status,
		error: row.error,
		context: JSON.parse(row.contextJson || '{}'),
		createdAt: row.createdAt
	};
}

const activeStates = ['queued', 'running'];
