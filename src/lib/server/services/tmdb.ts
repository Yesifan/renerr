import { getSettings } from './settings';
import { ApiError } from '$lib/server/api';
import { log } from './logs';

export type TmdbResult = {
	id: number;
	title: string;
	originalTitle: string;
	year?: number;
	posterPath?: string;
};

const defaultBaseUrl = 'https://api.themoviedb.org/3';

function tmdbBaseUrl() {
	return (
		process.env.RENARR_TMDB_BASE_URL ||
		process.env.RENERR_TMDB_BASE_URL ||
		process.env.TMDB_BASE_URL ||
		defaultBaseUrl
	);
}

export async function searchTmdb(
	mediaType: 'movie' | 'tv',
	query: string,
	apiKey?: string
): Promise<TmdbResult[]> {
	const settings = getSettings();
	const key = apiKey ?? settings.tmdbApiKey;
	if (!query.trim()) return [];
	if (!key) return [];
	const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
	const url = new URL(`${tmdbBaseUrl().replace(/\/$/, '')}/${endpoint}`);
	url.searchParams.set('api_key', key);
	url.searchParams.set('query', query);
	url.searchParams.set('language', settings.namingLanguage);
	url.searchParams.set('include_adult', 'false');
	const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
	if (!response.ok) throw tmdbError(response.status, endpoint);
	const data = (await response.json()) as { results?: Record<string, unknown>[] };
	return (data.results || []).slice(0, 8).map((row) => {
		const date = String(row.release_date || row.first_air_date || '');
		return {
			id: Number(row.id),
			title: String(row.title || row.name || ''),
			originalTitle: String(row.original_title || row.original_name || row.title || row.name || ''),
			year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined,
			posterPath: typeof row.poster_path === 'string' ? row.poster_path : undefined
		};
	});
}

export async function testTmdbConnection(input: { apiKey?: string } = {}) {
	const key = input.apiKey || getSettings().tmdbApiKey;
	if (!key) throw new ApiError('tmdb.unauthorized', 'TMDB API key is required', 400);
	const endpoint = 'configuration';
	const url = new URL(`${tmdbBaseUrl().replace(/\/$/, '')}/${endpoint}`);
	url.searchParams.set('api_key', key);
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
		if (!response.ok) throw tmdbError(response.status, endpoint);
		return { ok: true };
	} catch (error) {
		if (error instanceof ApiError) throw error;
		log('error', 'TmdbClient', 'TMDB connectivity test failed', {
			endpoint,
			error: error instanceof Error ? error.message : String(error)
		});
		throw new ApiError('tmdb.connection_failed', 'TMDB connection failed', 400);
	}
}

function tmdbError(status: number, endpoint: string) {
	const code =
		status === 401 || status === 403
			? 'tmdb.unauthorized'
			: status === 429
				? 'tmdb.rate_limited'
				: 'tmdb.connection_failed';
	const message =
		status === 401 || status === 403
			? 'TMDB API key is invalid'
			: status === 429
				? 'TMDB rate limited'
				: `TMDB request failed: ${status}`;
	log('warn', 'TmdbClient', message, { endpoint, status });
	return new ApiError(code, message, status === 429 ? 429 : 400, { status });
}

export function posterUrl(path?: string | null) {
	return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}
