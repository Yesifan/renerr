import { apiError, body, ok } from '$lib/server/api';
import { listSources, upsertSource } from '$lib/server/services/sources';
import type { RequestEvent } from './$types';

export function GET() {
	return ok(listSources());
}

export async function POST(event: RequestEvent) {
	try {
		return ok(upsertSource(await body(event)));
	} catch (error) {
		return apiError(error);
	}
}
