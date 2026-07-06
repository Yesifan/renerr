import { apiError, ok } from '$lib/server/api';
import { listTmdbTvSeasonEpisodes } from '$lib/server/services/tmdb';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	try {
		return ok(await listTmdbTvSeasonEpisodes(Number(event.params.id), Number(event.params.season)));
	} catch (error) {
		return apiError(error);
	}
}
