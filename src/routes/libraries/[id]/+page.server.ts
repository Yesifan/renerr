import { listItems } from '$lib/server/services/items';
import { getLibrary } from '$lib/server/services/sources';
import type { PageServerLoad } from './$types';

export const load = (async ({ params }) => {
	return {
		library: getLibrary(params.id),
		items: listItems(params.id)
	};
}) satisfies PageServerLoad;
