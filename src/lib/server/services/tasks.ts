import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { ApiError } from '$lib/server/api';
import { getDb } from '$lib/server/db';
import { renamePlanItems, renamePlans, tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { listTaskDetailLines } from './task-detail-lines';

export type TaskType =
	'scan_library_path' | 'scan_library_item' | 'create_rename_plan_for_item' | 'execute_rename_plan';

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
	if (type === 'create_rename_plan_for_item')
		return `libraryItem:${String(data.libraryItemId ?? '')}`;
	if (type === 'execute_rename_plan') return `renamePlan:${String(data.planId ?? '')}`;
	return `${type}:${JSON.stringify(payload ?? {})}`;
}

export function enqueueTask(type: TaskType, payload: TaskPayload, options: EnqueueOptions = {}) {
	const id = newId();
	const targetKey = taskTargetKey(type, payload);
	const existing = findActiveTask(type, targetKey);
	if (existing) return existing;
	if (type === 'execute_rename_plan')
		assertRenamePlanExecutable(String(payload.planId ?? ''), targetKey);
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

function assertRenamePlanExecutable(planId: string, targetKey: string) {
	const db = getDb();
	const plan = db.select().from(renamePlans).where(eq(renamePlans.id, planId)).get();
	if (!plan) {
		throw new ApiError('plan.invalid', 'Plan not found', 404);
	}
	if (plan.status !== 'confirmed') {
		throw new ApiError('plan.already_executed', 'Rename plan has already been executed', 409, {
			planId,
			status: plan.status
		});
	}
	const terminal = db
		.select()
		.from(tasks)
		.where(
			and(
				eq(tasks.type, 'execute_rename_plan'),
				eq(tasks.targetKey, targetKey),
				inArray(tasks.state, terminalStates)
			)
		)
		.orderBy(asc(tasks.createdAt))
		.limit(1)
		.get();
	if (terminal) {
		throw new ApiError('plan.already_executed', 'Rename plan has already been executed', 409, {
			planId,
			taskId: terminal.id,
			state: terminal.state
		});
	}
}

function findActiveTask(type: string, targetKey: string) {
	const row = getDb()
		.select()
		.from(tasks)
		.where(
			and(eq(tasks.type, type), eq(tasks.targetKey, targetKey), inArray(tasks.state, activeStates))
		)
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
	const expandedTargetKeys = targetKeys?.length ? expandActiveTargetKeys(targetKeys) : undefined;
	const where = expandedTargetKeys?.length
		? and(inArray(tasks.state, activeStates), inArray(tasks.targetKey, expandedTargetKeys))
		: inArray(tasks.state, activeStates);
	return getDb()
		.select()
		.from(tasks)
		.where(where)
		.orderBy(desc(tasks.createdAt))
		.all()
		.map(mapActiveTask);
}

function expandActiveTargetKeys(targetKeys: string[]) {
	const keys = new Set(targetKeys);
	const itemIds = targetKeys
		.filter((key) => key.startsWith('libraryItem:'))
		.map((key) => key.slice('libraryItem:'.length))
		.filter(Boolean);
	if (!itemIds.length) return [...keys];
	const planIds = getDb()
		.select({ planId: renamePlanItems.planId })
		.from(renamePlanItems)
		.where(inArray(renamePlanItems.libraryItemId, itemIds))
		.all();
	for (const row of planIds) {
		keys.add(`renamePlan:${row.planId}`);
	}
	return [...keys];
}

export function getTask(id: string) {
	const row = getDb().select().from(tasks).where(eq(tasks.id, id)).get();
	if (!row) throw new Error('Task not found');
	return mapTask(row);
}

export function getTaskDetail(id: string) {
	const task = getTask(id);
	return {
		task,
		lines: listTaskDetailLines(id),
		detailsCleaned: false
	};
}

export function failRunningTasksOnStartup() {
	const db = getDb();
	const running = db.select().from(tasks).where(eq(tasks.state, 'running')).all();
	for (const task of running) {
		const isRenameTask = task.type === 'execute_rename_plan';
		const summary = isRenameTask ? interruptedRenameSummary(task.payloadJson) : undefined;
		db.update(tasks)
			.set({
				state: 'failed',
				error: 'Worker restarted while task was running',
				resultSummaryJson: summary ? JSON.stringify(summary) : task.resultSummaryJson,
				finishedAt: nowIso()
			})
			.where(eq(tasks.id, task.id))
			.run();
		if (isRenameTask) {
			const planId = String((JSON.parse(task.payloadJson || '{}') as TaskPayload).planId ?? '');
			if (planId) {
				db.update(renamePlans).set({ status: 'executed' }).where(eq(renamePlans.id, planId)).run();
			}
		}
	}
}

function interruptedRenameSummary(payloadJson: string) {
	const payload = JSON.parse(payloadJson || '{}') as TaskPayload;
	const planId = String(payload.planId ?? '');
	const rows = planId
		? getDb().select().from(renamePlanItems).where(eq(renamePlanItems.planId, planId)).all()
		: [];
	const counts = rows.reduce(
		(acc, row) => {
			if (row.status === 'succeeded') acc.succeeded += 1;
			else if (row.status === 'failed' || row.status === 'conflict') acc.failed += 1;
			else acc.pending += 1;
			return acc;
		},
		{ succeeded: 0, failed: 0, pending: 0 }
	);
	return {
		interrupted: true,
		reason: 'worker_restarted',
		planId,
		...counts,
		guidance: 'Scan affected directories before creating another rename plan.'
	};
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
	getDb().update(tasks).set(values).where(eq(tasks.id, id)).run();
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
	if (type === 'create_rename_plan_for_item') return String(payload.libraryItemId ?? '');
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

const activeStates = ['queued', 'running'];
const terminalStates = ['succeeded', 'partially_failed', 'failed'];
