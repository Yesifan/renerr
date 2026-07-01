import { apiError, ok } from '$lib/server/api';
import { getTaskDetail } from '$lib/server/services/tasks';
import type { RequestEvent } from './$types';

export function GET(event: RequestEvent) {
	try {
		return ok(getTaskDetail(event.params.id));
	} catch (error) {
		return apiError(error);
	}
}
