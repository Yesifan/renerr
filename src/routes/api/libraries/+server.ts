import { apiError, body, ok } from '$lib/server/api';
import { createLibrary, listLibraries } from '$lib/server/services/sources';
import { libraryPathInputSchema } from '$lib/schemas/domain';
import type { RequestEvent } from './$types';

export function GET() {
	return ok(listLibraries());
}

export async function POST(event: RequestEvent) {
	try {
		return ok(createLibrary(libraryPathInputSchema.parse(await body(event))));
	} catch (error) {
		return apiError(error);
	}
}
