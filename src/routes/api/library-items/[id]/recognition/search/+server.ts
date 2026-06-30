import { ApiError, apiError, ok } from '$lib/server/api';
import { getSqlite } from '$lib/server/db';
import { getLibrary } from '$lib/server/services/sources';
import { searchTmdb } from '$lib/server/services/tmdb';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	try {
		const query = (event.url.searchParams.get('q') || '').trim();
		if (!query) throw new ApiError('validation_failed', 'Search query is required', 400);
		const item = getSqlite()
			.prepare('select library_path_id from library_items where id = ?')
			.get(event.params.id) as { library_path_id: string } | undefined;
		if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
		const library = getLibrary(item.library_path_id);
		return ok(await searchTmdb(library.mediaType, query));
	} catch (error) {
		return apiError(error);
	}
}
