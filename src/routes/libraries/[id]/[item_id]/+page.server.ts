import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { getItem } from '$lib/server/services/items';
import { getLibrary } from '$lib/server/services/sources';
import type { PageServerLoad } from './$types';

export const load = (async ({ params }) => {
	try {
		const library = getLibrary(params.id);
		const item = getItem(params.item_id);

		if (item.libraryPathId !== library.id) {
			error(404, 'Library item not found in this library path');
		}

		return {
			library,
			item
		};
	} catch (loadError) {
		if (loadError instanceof ApiError && loadError.status === 404) {
			error(404, loadError.message);
		}
		if (loadError instanceof Error && loadError.message === 'Library path not found') {
			error(404, loadError.message);
		}
		throw loadError;
	}
}) satisfies PageServerLoad;
