import { apiError, body, ok } from '$lib/server/api';
import { updateLibrary } from '$lib/server/services/sources';
import type { RequestEvent } from './$types';

export async function PUT(event: RequestEvent) {
	try {
		return ok(updateLibrary(event.params.id, await body(event)));
	} catch (error) {
		return apiError(error);
	}
}
