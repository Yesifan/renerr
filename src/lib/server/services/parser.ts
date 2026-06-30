import { basename, stripExt } from './paths';

export function normalizeTitle(value: string) {
	return value
		.normalize('NFKC')
		.toLowerCase()
		.replace(/\b(2160p|1080p|720p|web-dl|bluray|x264|x265|h264|h265|hevc|aac)\b/g, ' ')
		.replace(/[._()[\]{}-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function extractYear(value: string) {
	const match = value.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
	return match ? Number(match[1]) : undefined;
}

export function parseMovieName(value: string) {
	const name = stripExt(basename(value));
	const year = extractYear(name);
	const title = normalizeTitle(name.replace(/(?:19|20)\d{2}/, ''));
	return { title, year };
}

export function parseTvName(value: string) {
	const name = stripExt(basename(value));
	const sxe = name.match(/[Ss](\d{1,2})[ ._-]*[Ee](\d{1,3})/);
	if (sxe) {
		return {
			title: normalizeTitle(name.slice(0, sxe.index)),
			season: Number(sxe[1]),
			episode: Number(sxe[2]),
			year: extractYear(name)
		};
	}
	const tailNumber = name.match(/(.+?)[ ._-]+(\d{1,3})$/);
	if (tailNumber) {
		return {
			title: normalizeTitle(tailNumber[1]),
			season: 1,
			episode: Number(tailNumber[2]),
			year: extractYear(name)
		};
	}
	if (/^\d{1,3}$/.test(name)) {
		return { title: '', season: 1, episode: Number(name), year: undefined };
	}
	return {
		title: normalizeTitle(name),
		season: undefined,
		episode: undefined,
		year: extractYear(name)
	};
}
