import { listLibraries } from '$lib/server/services/sources';
import type { LayoutServerLoad } from './$types';

export const load = (async () => {
	return {
		navigationLibraries: listLibraries()
	};
}) satisfies LayoutServerLoad;
