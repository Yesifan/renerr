import { getSettings } from './settings';
import { ApiError } from '$lib/server/api';
import { createNodeLogger } from '$lib/server/logger';

export type TmdbResult = {
	id: number;
	title: string;
	originalTitle: string;
	year?: number;
	posterPath?: string;
	posterUrl: string | null;
	overview: string;
};

export type TmdbSeasonOption = {
	number: number;
	name: string;
	episodeCount: number | null;
	airDate: string | null;
};

export type TmdbEpisodeOption = {
	season: number;
	episode: number;
	name: string;
	airDate: string | null;
	overview: string;
};

const defaultBaseUrl = 'https://api.themoviedb.org/3';
const tmdbLogger = createNodeLogger('server', { component: 'TmdbClient' });

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
			posterPath: typeof row.poster_path === 'string' ? row.poster_path : undefined,
			posterUrl: posterUrl(typeof row.poster_path === 'string' ? row.poster_path : null),
			overview: typeof row.overview === 'string' ? row.overview : ''
		};
	});
}

export async function listTmdbTvSeasons(tvId: number): Promise<TmdbSeasonOption[]> {
	const endpoint = `tv/${positiveInteger(tvId, 'tmdb.invalid_id')}`;
	const data = await tmdbGet(endpoint);
	const rows = Array.isArray(data.seasons) ? data.seasons : [];
	return rows
		.map((row) => {
			const season = record(row);
			return {
				number: numberOrNull(season.season_number) ?? 0,
				name: stringOrEmpty(season.name),
				episodeCount: numberOrNull(season.episode_count),
				airDate: stringOrNull(season.air_date)
			};
		})
		.sort((a, b) => a.number - b.number);
}

export async function listTmdbTvSeasonEpisodes(
	tvId: number,
	seasonNumber: number
): Promise<TmdbEpisodeOption[]> {
	const tv = positiveInteger(tvId, 'tmdb.invalid_id');
	const season = nonNegativeInteger(seasonNumber, 'tmdb.invalid_season');
	const endpoint = `tv/${tv}/season/${season}`;
	const data = await tmdbGet(endpoint);
	const rows = Array.isArray(data.episodes) ? data.episodes : [];
	return rows
		.map((row) => {
			const episode = record(row);
			return {
				season,
				episode: numberOrNull(episode.episode_number) ?? 0,
				name: stringOrEmpty(episode.name),
				airDate: stringOrNull(episode.air_date),
				overview: stringOrEmpty(episode.overview)
			};
		})
		.filter((episode) => episode.episode > 0)
		.sort((a, b) => a.episode - b.episode);
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
		tmdbLogger.error(
			{
				endpoint,
				err: error
			},
			'TMDB connectivity test failed'
		);
		throw new ApiError('tmdb.connection_failed', 'TMDB connection failed', 400);
	}
}

async function tmdbGet(endpoint: string) {
	const settings = getSettings();
	const key = settings.tmdbApiKey;
	if (!key) throw new ApiError('tmdb.unauthorized', 'TMDB API key is required', 400);
	const url = new URL(`${tmdbBaseUrl().replace(/\/$/, '')}/${endpoint}`);
	url.searchParams.set('api_key', key);
	url.searchParams.set('language', settings.namingLanguage);
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
		if (!response.ok) throw tmdbError(response.status, endpoint);
		return (await response.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof ApiError) throw error;
		tmdbLogger.error({ endpoint, err: error }, 'TMDB request failed');
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
	tmdbLogger.warn({ endpoint, status }, message);
	return new ApiError(code, message, status === 429 ? 429 : 400, { status });
}

export function posterUrl(path?: string | null) {
	return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

function positiveInteger(value: number, code: string) {
	if (!Number.isInteger(value) || value <= 0) throw new ApiError(code, 'Invalid TMDB id', 400);
	return value;
}

function nonNegativeInteger(value: number, code: string) {
	if (!Number.isInteger(value) || value < 0) throw new ApiError(code, 'Invalid TMDB season', 400);
	return value;
}

function record(value: unknown) {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function numberOrNull(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
	return typeof value === 'string' && value ? value : null;
}

function stringOrEmpty(value: unknown) {
	return typeof value === 'string' ? value : '';
}
