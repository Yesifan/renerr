import { json, type RequestEvent } from '@sveltejs/kit';
import { ZodError } from 'zod';

export class ApiError extends Error {
	code: string;
	status: number;
	context?: Record<string, unknown>;

	constructor(code: string, message: string, status = 400, context?: Record<string, unknown>) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
		this.status = status;
		this.context = context;
	}
}

export function ok(data: unknown) {
	return json(data);
}

export async function body(event: RequestEvent) {
	return event.request.json().catch(() => ({}));
}

export function apiError(error: unknown) {
	if (error instanceof ApiError) {
		return json(
			{
				code: error.code,
				message: error.message,
				...(error.context ? { context: error.context } : {})
			},
			{ status: error.status }
		);
	}
	if (error instanceof ZodError) {
		return json(
			{
				code: 'validation_failed',
				message: 'Validation failed',
				context: { issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }
			},
			{ status: 400 }
		);
	}
	const message = error instanceof Error ? error.message : String(error);
	return json({ code: 'unknown', message: message || 'Unknown error' }, { status: 400 });
}
