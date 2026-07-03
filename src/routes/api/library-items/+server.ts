import { apiError, ok } from '$lib/server/api';
import { listItems } from '$lib/server/services/items';
import { libraryItemsQuerySchema } from '$lib/schemas/domain';
import type { RequestEvent } from './$types';

export function GET(event: RequestEvent) {
	try {
		const query = libraryItemsQuerySchema.parse({
			libraryPathId: event.url.searchParams.get('libraryPathId') || undefined,
			includeEmpty: event.url.searchParams.get('includeEmpty') === 'true' || undefined
		});
		return ok(listItems(query));
	} catch (error) {
		return apiError(error);
	}
}
