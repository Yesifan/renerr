import { apiError, ok } from '$lib/server/api';
import { listTmdbTvSeasons } from '$lib/server/services/tmdb';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	try {
		return ok(await listTmdbTvSeasons(Number(event.params.id)));
	} catch (error) {
		return apiError(error);
	}
}
