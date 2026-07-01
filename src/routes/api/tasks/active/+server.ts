import { ok } from '$lib/server/api';
import { listActiveTasks } from '$lib/server/services/tasks';
import type { RequestEvent } from './$types';

export function GET(event: RequestEvent) {
	const targetKeys = event.url.searchParams.getAll('targetKey');
	return ok(listActiveTasks(targetKeys.length ? targetKeys : undefined));
}
