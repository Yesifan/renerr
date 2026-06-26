import { apiError, body, ok } from '$lib/server/api';
import { createLibrary, listLibraries } from '$lib/server/services/sources';
import type { RequestEvent } from './$types';

export function GET() {
	return ok(listLibraries());
}

export async function POST(event: RequestEvent) {
	try {
		return ok(createLibrary(await body(event)));
	} catch (error) {
		return apiError(error);
	}
}
