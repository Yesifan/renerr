import { ApiError, apiError, ok } from '$lib/server/api';
import { getItem } from '$lib/server/services/items';
import { enqueueTask } from '$lib/server/services/tasks';
import type { RequestEvent } from './$types';

export function POST(event: RequestEvent) {
	try {
		const item = getItem(event.params.id);
		if (item.status !== 'organized' && item.status !== 'unidentified') {
			return apiError(
				new ApiError(
					'item.scan_not_allowed',
					'Library item cannot be scanned in its current status',
					400,
					{
						status: item.status
					}
				)
			);
		}
		return ok(enqueueTask('scan_library_item', { libraryItemId: event.params.id }));
	} catch (error) {
		return apiError(error);
	}
}
