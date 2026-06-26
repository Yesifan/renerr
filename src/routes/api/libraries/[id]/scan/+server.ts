import { apiError, ok } from '$lib/server/api';
import { enqueueTask } from '$lib/server/services/tasks';
import type { RequestEvent } from './$types';

export function POST(event: RequestEvent) {
	try {
		return ok(enqueueTask('scan_library_path', { libraryPathId: event.params.id }));
	} catch (error) {
		return apiError(error);
	}
}
