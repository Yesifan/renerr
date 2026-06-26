import { getSettings } from './settings';

export type TmdbResult = {
	id: number;
	title: string;
	originalTitle: string;
	year?: number;
	posterPath?: string;
};

const baseUrl = 'https://api.themoviedb.org/3';

export async function searchTmdb(mediaType: 'movie' | 'tv', query: string): Promise<TmdbResult[]> {
	const settings = getSettings();
	if (!settings.tmdbApiKey) return [];
	const endpoint = mediaType === 'movie' ? 'search/movie' : 'search/tv';
	const url = new URL(`${baseUrl}/${endpoint}`);
	url.searchParams.set('api_key', settings.tmdbApiKey);
	url.searchParams.set('query', query);
	url.searchParams.set('language', settings.namingLanguage);
	url.searchParams.set('include_adult', 'false');
	const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
	if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
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

export function posterUrl(path?: string | null) {
	return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}
