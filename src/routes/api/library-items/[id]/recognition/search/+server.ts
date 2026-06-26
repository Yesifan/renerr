import { apiError, ok } from '$lib/server/api';
import { searchTmdb } from '$lib/server/services/tmdb';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	try {
		const type = event.url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
		return ok(await searchTmdb(type, event.url.searchParams.get('q') || ''));
	} catch (error) {
		return apiError(error);
	}
}
