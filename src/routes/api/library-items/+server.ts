import { ok } from '$lib/server/api';
import { listItems } from '$lib/server/services/items';
import type { RequestEvent } from './$types';

export function GET(event: RequestEvent) {
	return ok(listItems(event.url.searchParams.get('libraryPathId') || undefined));
}
