import { apiError, body, ok } from '$lib/server/api';
import { testTmdbConnection } from '$lib/server/services/tmdb';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		return ok(await testTmdbConnection((await body(event)) as { apiKey?: string }));
	} catch (error) {
		return apiError(error);
	}
}
