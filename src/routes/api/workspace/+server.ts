import { apiError, ok } from '$lib/server/api';
import { listItems } from '$lib/server/services/items';
import { listLibraries, listSources } from '$lib/server/services/sources';
import { listTasks } from '$lib/server/services/tasks';
import { publicSettings } from '$lib/server/services/settings';

export function GET() {
	try {
		return ok({
			sources: listSources(),
			libraries: listLibraries(),
			items: listItems(),
			tasks: listTasks(20),
			settings: publicSettings()
		});
	} catch (error) {
		return apiError(error);
	}
}
