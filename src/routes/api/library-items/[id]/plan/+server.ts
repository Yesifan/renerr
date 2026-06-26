import { apiError, ok } from '$lib/server/api';
import { createDraftForItem } from '$lib/server/services/planner';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		return ok(await createDraftForItem(event.params.id));
	} catch (error) {
		return apiError(error);
	}
}
