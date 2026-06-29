import { listItems } from '$lib/server/services/items';
import { listLibraries } from '$lib/server/services/sources';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	const libraries = listLibraries();
	const itemCounts = listItems().reduce<Record<string, number>>((counts, item) => {
		counts[item.libraryPathId] = (counts[item.libraryPathId] ?? 0) + 1;
		return counts;
	}, {});

	return {
		libraries,
		itemCounts
	};
}) satisfies PageServerLoad;
