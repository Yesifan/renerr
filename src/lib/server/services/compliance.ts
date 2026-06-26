import { parseMovieName, parseTvName } from './parser';

export function isCompliantVideo(mediaType: 'movie' | 'tv', path: string) {
	const basename = path.split('/').at(-1) || path;
	if (mediaType === 'movie') {
		const parsed = parseMovieName(basename);
		return Boolean(parsed.title && parsed.year);
	}
	const parsed = parseTvName(basename);
	return Boolean(parsed.title && parsed.season && parsed.episode);
}
