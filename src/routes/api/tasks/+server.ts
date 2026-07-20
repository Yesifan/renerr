import { ok } from '$lib/server/api';
import { listTasks, type TaskType } from '$lib/server/services/tasks';
import type { RequestEvent } from './$types';

const taskTypes: TaskType[] = [
	'scan_library_path',
	'scan_library_item',
	'create_rename_plan_for_item',
	'execute_rename_plan'
];

export function GET(event: RequestEvent) {
	const type = event.url.searchParams.get('type');
	const limit = Number(event.url.searchParams.get('limit') ?? '');
	return ok(
		listTasks({
			type: taskTypes.includes(type as TaskType) ? (type as TaskType) : null,
			limit: Number.isFinite(limit) ? limit : undefined
		})
	);
}
