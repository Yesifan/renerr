import { ok } from '$lib/server/api';
import { clearLogs } from '$lib/server/services/logs';

export function POST() {
	clearLogs();
	return ok({ ok: true });
}
