import { apiError, ok } from '$lib/server/api';
import { getItemDetail } from '$lib/server/services/items';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	try {
		return ok(await getItemDetail(event.params.id));
	} catch (error) {
		return apiError(error);
	}
}
