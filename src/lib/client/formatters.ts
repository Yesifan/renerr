import { statusLabel } from '$lib/i18n';
import type { Library } from '$lib/schemas/domain';

export function libraryLabel(library: Library) {
	return `/${library.sourceName}${library.path}`;
}

export function statusText(status: string, reason: string | null = null) {
	return statusLabel(status, reason);
}

export function statusClass(status: string) {
	if (status === 'failed') return 'bg-red-500/15 text-red-300';
	if (status === 'pending_review' || status === 'partially_failed') return 'bg-amber-500/15 text-amber-300';
	if (status === 'identified' || status === 'running') return 'bg-sky-500/15 text-sky-300';
	if (status === 'organized' || status === 'succeeded') return 'bg-emerald-500/15 text-emerald-300';
	return 'bg-slate-500/15 text-slate-300';
}
