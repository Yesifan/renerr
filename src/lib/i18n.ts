import { m } from '$lib/paraglide/messages';
import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';

export { getLocale, locales, setLocale };
export type { Locale };

export const messages = m;

export function setBrowserLocale(locale: Locale) {
	setLocale(locale, { reload: false });
}

export function statusLabel(status: string, reason?: string | null) {
	const labels: Record<string, () => string> = {
		unidentified: m.state_unidentified,
		pending_review: m.state_pending_review,
		identified: m.state_identified,
		organized: m.state_organized,
		queued: m.state_queued,
		running: m.state_running,
		failed: m.state_failed,
		succeeded: m.state_succeeded,
		partially_failed: m.state_partially_failed
	};
	const label = labels[status]?.() ?? status;
	return status === 'pending_review' && reason ? `${label} · ${reason}` : label;
}

export function errorLabel(code?: string, fallback?: string) {
	const labels: Record<string, () => string> = {
		validation_failed: m.error_validation_failed,
		'webdav.connection_failed': m.error_webdav_connection_failed,
		'webdav.path_unreadable': m.error_webdav_path_unreadable,
		'tmdb.connection_failed': m.error_tmdb_connection_failed,
		'tmdb.unauthorized': m.error_tmdb_unauthorized,
		'tmdb.rate_limited': m.error_tmdb_rate_limited,
		'item.not_found': m.error_item_not_found,
		'item.scan_not_allowed': m.error_item_scan_not_allowed,
		'item.plan_not_allowed': m.error_item_plan_not_allowed,
		'plan.invalid': m.error_plan_invalid,
		'plan.conflict_unresolved': m.error_conflict_unresolved,
		'file.source_missing': m.error_source_missing,
		'file.target_exists': m.error_target_exists
	};
	if (code && labels[code]) return labels[code]();
	return fallback || m.error_fallback();
}
