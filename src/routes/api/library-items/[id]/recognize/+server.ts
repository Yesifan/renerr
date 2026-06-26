import { apiError, body, ok } from '$lib/server/api';
import { setItemIdentity } from '$lib/server/services/items';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		return ok(setItemIdentity(event.params.id, (await body(event)) as never));
	} catch (error) {
		return apiError(error);
	}
}
