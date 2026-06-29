import { errorLabel } from '$lib/i18n';

export type ApiErrorDto = {
	code: string;
	message: string;
	context?: unknown;
};

export class ClientApiError extends Error {
	code: string;
	safeMessage: string;
	context?: unknown;

	constructor(dto: ApiErrorDto) {
		super(errorLabel(dto.code, dto.message));
		this.name = 'ClientApiError';
		this.code = dto.code;
		this.safeMessage = dto.message;
		this.context = dto.context;
	}
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	const data = await response.json();
	if (!response.ok) {
		const dto: ApiErrorDto = {
			code: typeof data?.code === 'string' ? data.code : 'unknown',
			message: typeof data?.message === 'string' ? data.message : response.statusText,
			context: data?.context
		};
		throw new ClientApiError(dto);
	}
	return data;
}

export function post<T = unknown>(url: string, payload: unknown = {}) {
	return api<T>(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}

export function put<T = unknown>(url: string, payload: unknown = {}) {
	return api<T>(url, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}
