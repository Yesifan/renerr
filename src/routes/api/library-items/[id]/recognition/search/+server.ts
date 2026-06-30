import { eq } from 'drizzle-orm';
import { ApiError, apiError, ok } from '$lib/server/api';
import { getDb } from '$lib/server/db';
import { libraryItems } from '$lib/server/db/schema';
import { getLibrary } from '$lib/server/services/sources';
import { searchTmdb } from '$lib/server/services/tmdb';
import type { RequestEvent } from './$types';

export async function GET(event: RequestEvent) {
	try {
		const query = (event.url.searchParams.get('q') || '').trim();
		if (!query) throw new ApiError('validation_failed', 'Search query is required', 400);
		const item = getDb()
			.select({ libraryPathId: libraryItems.libraryPathId })
			.from(libraryItems)
			.where(eq(libraryItems.id, event.params.id))
			.get();
		if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
		const library = getLibrary(item.libraryPathId);
		return ok(await searchTmdb(library.mediaType, query));
	} catch (error) {
		return apiError(error);
	}
}
