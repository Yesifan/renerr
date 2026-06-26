import { apiError, body, ok } from '$lib/server/api';
import { publicSettings, saveSettings } from '$lib/server/services/settings';
import type { RequestEvent } from './$types';

export function GET() {
	return ok(publicSettings());
}

export async function PUT(event: RequestEvent) {
	try {
		saveSettings(await body(event));
		return ok(publicSettings());
	} catch (error) {
		return apiError(error);
	}
}
