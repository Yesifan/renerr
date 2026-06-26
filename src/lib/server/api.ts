import { json, type RequestEvent } from '@sveltejs/kit';
import { ZodError } from 'zod';

export function ok(data: unknown) {
	return json(data);
}

export async function body(event: RequestEvent) {
	return event.request.json().catch(() => ({}));
}

export function apiError(error: unknown) {
	const message =
		error instanceof ZodError
			? error.issues.map((issue) => issue.message).join(', ')
			: error instanceof Error
				? error.message
				: String(error);
	return json({ error: message }, { status: 400 });
}
