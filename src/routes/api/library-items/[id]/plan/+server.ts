import { apiError, ok } from '$lib/server/api';
import { createPlanForItem } from '$lib/server/services/planner';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		return ok(await createPlanForItem(event.params.id, 'manual'));
	} catch (error) {
		return apiError(error);
	}
}
