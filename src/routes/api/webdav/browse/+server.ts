import { apiError, body, ok } from '$lib/server/api';
import { browseWebdav } from '$lib/server/services/sources';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent) {
	try {
		const input = (await body(event)) as { sourceId: string; path?: string };
		return ok(await browseWebdav(input.sourceId, input.path || '/'));
	} catch (error) {
		return apiError(error);
	}
}
