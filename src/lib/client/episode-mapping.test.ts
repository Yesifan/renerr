import { describe, expect, test } from 'vitest';
import {
	findEpisodeMappingOption,
	formatEpisodeMappingDisplayLabel,
	formatEpisodeMappingInput,
	formatEpisodeMappingPreview,
	isEpisodeMappingInputInvalid,
	parseEpisodeMappingInput
} from './episode-mapping';

describe('episode mapping input', () => {
	test('parses complete season/episode input', () => {
		expect(parseEpisodeMappingInput('1/1')).toEqual({
			status: 'valid',
			input: '1/1',
			mapping: { season: 1, episode: 1 }
		});
		expect(parseEpisodeMappingInput(' 12/8 ')).toEqual({
			status: 'valid',
			input: '12/8',
			mapping: { season: 12, episode: 8 }
		});
	});

	test('rejects incomplete and nonnumeric input', () => {
		expect(parseEpisodeMappingInput('')).toMatchObject({ status: 'invalid', reason: 'empty' });
		expect(parseEpisodeMappingInput('1')).toMatchObject({
			status: 'invalid',
			reason: 'missing_slash'
		});
		expect(parseEpisodeMappingInput('1/')).toMatchObject({
			status: 'invalid',
			reason: 'missing_episode'
		});
		expect(parseEpisodeMappingInput('/1')).toMatchObject({
			status: 'invalid',
			reason: 'missing_season'
		});
		expect(parseEpisodeMappingInput('s1/e1')).toMatchObject({
			status: 'invalid',
			reason: 'nonnumeric'
		});
	});

	test('formats committed values and previews', () => {
		expect(formatEpisodeMappingInput(1, 8)).toBe('1/8');
		expect(formatEpisodeMappingInput(1, null)).toBe('');
		expect(formatEpisodeMappingPreview({ season: 1, episode: 8 })).toBe('S01E08');
		expect(formatEpisodeMappingPreview({ season: 12, episode: 10 })).toBe('S12E10');
		expect(formatEpisodeMappingPreview(null)).toBe('');
	});

	test('only reports local invalid input after the user edits it', () => {
		expect(isEpisodeMappingInputInvalid('', '1/6', false)).toBe(false);
		expect(isEpisodeMappingInputInvalid('1/', '1/6', true)).toBe(true);
		expect(isEpisodeMappingInputInvalid('1/6', '1/6', true)).toBe(false);
		expect(isEpisodeMappingInputInvalid('2/6', '1/6', true)).toBe(false);
	});

	test('formats blurred display labels from optional episode metadata', () => {
		const options = [
			{ season: 5, episode: 26, name: '第12期' },
			{ season: 5, episode: 27, name: '第13期：抉择' }
		];
		const mapping = { season: 5, episode: 27 };

		expect(findEpisodeMappingOption(options, mapping)).toEqual({
			season: 5,
			episode: 27,
			name: '第13期：抉择'
		});
		expect(
			formatEpisodeMappingDisplayLabel(mapping, findEpisodeMappingOption(options, mapping))
		).toBe('S05E27 · 第13期：抉择');
		expect(formatEpisodeMappingDisplayLabel(mapping)).toBe('S05E27');
		expect(formatEpisodeMappingDisplayLabel(null)).toBe('');
	});
});
