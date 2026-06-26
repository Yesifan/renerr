import type { AppSettings, MediaType } from '$lib/schemas/domain';
import { dirname, extname, joinRemote, sanitizeSegment } from './paths';

type RenderInput = {
	title: string;
	year?: number | null;
	season?: number | null;
	episode?: number | null;
	extension?: string;
};

export function renderTemplate(template: string, input: RenderInput) {
	return sanitizeSegment(
		template
			.replaceAll('{title}', input.title)
			.replaceAll('{year}', String(input.year || ''))
			.replaceAll('{season:00}', pad(input.season))
			.replaceAll('{episode:00}', pad(input.episode))
			.replaceAll('{season}', String(input.season || ''))
			.replaceAll('{episode}', String(input.episode || ''))
	);
}

export function targetPathFor(
	libraryRoot: string,
	mediaType: MediaType,
	sourceFilePath: string,
	input: RenderInput,
	settings: AppSettings
) {
	const extension = input.extension || extname(sourceFilePath);
	if (mediaType === 'movie') {
		const folder = renderTemplate(settings.movieFolderTemplate, input);
		const file = `${renderTemplate(settings.movieFileTemplate, input)}${extension}`;
		return {
			targetTopLevelPath: folder,
			targetFilePath: joinRemote(libraryRoot, folder, file)
		};
	}
	const showFolder = renderTemplate(settings.tvRootFolderTemplate, input);
	const seasonFolder = renderTemplate(settings.seasonFolderTemplate, input);
	const file = `${renderTemplate(settings.tvEpisodeFileTemplate, input)}${extension}`;
	return {
		targetTopLevelPath: showFolder,
		targetFilePath: joinRemote(libraryRoot, showFolder, seasonFolder, file)
	};
}

export function metadataTargets(targetFilePath: string, mediaType: MediaType) {
	const topFolder = mediaType === 'movie' ? dirname(targetFilePath) : dirname(dirname(targetFilePath));
	return mediaType === 'movie'
		? { nfo: targetFilePath.replace(/\.[^.]+$/, '.nfo'), poster: joinRemote(topFolder, 'poster.jpg') }
		: { nfo: joinRemote(topFolder, 'tvshow.nfo'), poster: joinRemote(topFolder, 'poster.jpg') };
}

function pad(value?: number | null) {
	return String(value || 0).padStart(2, '0');
}
