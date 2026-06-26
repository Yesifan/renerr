import { ok } from '$lib/server/api';
import { listLogs } from '$lib/server/services/logs';

export function GET() {
	return ok(listLogs());
}
