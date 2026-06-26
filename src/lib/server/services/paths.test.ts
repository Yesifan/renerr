import { describe, expect, it } from 'vitest';
import { joinRemote, normalizeRemotePath, sanitizeSegment } from './paths';
import { extractYear, parseTvName } from './parser';
import { renderTemplate } from './naming';

describe('path helpers', () => {
	it('normalizes remote POSIX paths', () => {
		expect(normalizeRemotePath('quark/待整理影视/')).toBe('/quark/待整理影视');
		expect(joinRemote('/quark', '待整理影视', '甄嬛传 (2011)')).toBe('/quark/待整理影视/甄嬛传 (2011)');
	});

	it('sanitizes path segments', () => {
		expect(sanitizeSegment(' A/B:*?  .')).toBe('A B');
	});
});

describe('filename parsing', () => {
	it('extracts year', () => {
		expect(extractYear('Inception (2010)')).toBe(2010);
	});

	it('parses numeric tv root files as season one episodes', () => {
		expect(parseTvName('甄嬛传.40.mp4')).toMatchObject({
			title: '甄嬛传',
			season: 1,
			episode: 40
		});
	});

	it('parses pure numeric episode files inside tv folders', () => {
		expect(parseTvName('40.mp4')).toMatchObject({
			title: '',
			season: 1,
			episode: 40
		});
	});
});

describe('naming', () => {
	it('renders padded season and episode variables', () => {
		expect(
			renderTemplate('{title}.{year}.s{season:00}e{episode:00}', {
				title: '甄嬛传',
				year: 2011,
				season: 1,
				episode: 4
			})
		).toBe('甄嬛传.2011.s01e04');
	});
});
