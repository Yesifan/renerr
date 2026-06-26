import { apiError, body, ok } from '$lib/server/api';
import { testLibraryPath } from '$lib/server/services/sources';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		return ok(await testLibraryPath(await body(event)));
	} catch (error) {
		return apiError(error);
	}
}
