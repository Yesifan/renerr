import { apiError, body, ok } from '$lib/server/api';
import { getDraft, updateDraft } from '$lib/server/services/planner';
import type { RequestEvent } from './$types';

export function GET(event: RequestEvent) {
	try {
		return ok(getDraft(event.params.id));
	} catch (error) {
		return apiError(error);
	}
}

export async function PUT(event: RequestEvent) {
	try {
		return ok(await updateDraft(event.params.id, await body(event)));
	} catch (error) {
		return apiError(error);
	}
}
