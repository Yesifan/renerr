import { apiError, body, ok } from '$lib/server/api';
import { testWebdavConnection } from '$lib/server/services/sources';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		const input = await body(event);
		return ok(await testWebdavConnection(input, input.id));
	} catch (error) {
		return apiError(error);
	}
}
