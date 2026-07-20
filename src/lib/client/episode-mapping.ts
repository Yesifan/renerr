export type EpisodeMapping = {
	season: number;
	episode: number;
};

export type EpisodeMappingParseResult =
	| {
			status: 'valid';
			input: string;
			mapping: EpisodeMapping;
	  }
	| {
			status: 'invalid';
			input: string;
			reason: 'empty' | 'missing_slash' | 'missing_season' | 'missing_episode' | 'nonnumeric';
	  };

const COMPLETE_MAPPING = /^(\d+)\/(\d+)$/;

export function parseEpisodeMappingInput(input: string): EpisodeMappingParseResult {
	const value = input.trim();
	if (!value) return { status: 'invalid', input: value, reason: 'empty' };
	if (!value.includes('/')) return { status: 'invalid', input: value, reason: 'missing_slash' };

	const [season = '', episode = '', extra] = value.split('/');
	if (extra !== undefined) return { status: 'invalid', input: value, reason: 'nonnumeric' };
	if (!season) return { status: 'invalid', input: value, reason: 'missing_season' };
	if (!episode) return { status: 'invalid', input: value, reason: 'missing_episode' };
	if (!COMPLETE_MAPPING.test(value))
		return { status: 'invalid', input: value, reason: 'nonnumeric' };

	return {
		status: 'valid',
		input: value,
		mapping: {
			season: Number(season),
			episode: Number(episode)
		}
	};
}

export function formatEpisodeMappingInput(season: number | null, episode: number | null) {
	return season === null || episode === null ? '' : `${season}/${episode}`;
}

export function isEpisodeMappingInputInvalid(
	input: string,
	committedInput: string,
	touched: boolean
) {
	return (
		touched && input !== committedInput && parseEpisodeMappingInput(input).status === 'invalid'
	);
}

export function formatEpisodeMappingPreview(mapping: EpisodeMapping | null) {
	if (!mapping) return '';
	return `S${pad2(mapping.season)}E${pad2(mapping.episode)}`;
}

export function findEpisodeMappingOption<T extends { season: number; episode: number }>(
	options: T[],
	mapping: EpisodeMapping | null
) {
	if (!mapping) return undefined;
	return options.find(
		(option) => option.season === mapping.season && option.episode === mapping.episode
	);
}

export function formatEpisodeMappingDisplayLabel(
	mapping: EpisodeMapping | null,
	option?: { name?: string | null }
) {
	const preview = formatEpisodeMappingPreview(mapping);
	if (!preview) return '';
	const name = option?.name?.trim();
	return name ? `${preview} · ${name}` : preview;
}

function pad2(value: number) {
	return String(value).padStart(2, '0');
}
