import { ok } from '$lib/server/api';
import { listTasks } from '$lib/server/services/tasks';

export function GET() {
	return ok(listTasks());
}
