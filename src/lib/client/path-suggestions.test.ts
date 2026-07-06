import { describe, expect, test } from 'vitest';
import { filterDirectorySuggestions, joinRemotePath, pathQueryParts } from './path-suggestions';

describe('path suggestions', () => {
	test('parses root and nested inputs into parent directory and basename filter', () => {
		expect(pathQueryParts('')).toEqual({ parentPath: '/', basename: '' });
		expect(pathQueryParts('/')).toEqual({ parentPath: '/', basename: '' });
		expect(pathQueryParts('/tv')).toEqual({ parentPath: '/', basename: 'tv' });
		expect(pathQueryParts('/tv/')).toEqual({ parentPath: '/tv', basename: '' });
		expect(pathQueryParts('/tv/Sh')).toEqual({ parentPath: '/tv', basename: 'Sh' });
		expect(pathQueryParts('tv//Show')).toEqual({ parentPath: '/tv', basename: 'Show' });
	});

	test('filters directory suggestions locally by basename', () => {
		const options = [
			{ basename: 'Show A', type: 'directory' as const },
			{ basename: 'Movie Root', type: 'directory' as const },
			{ basename: 'show B', type: 'directory' as const }
		];

		expect(filterDirectorySuggestions(options, 'sho')).toEqual([
			{ basename: 'Show A', type: 'directory' },
			{ basename: 'show B', type: 'directory' }
		]);
	});

	test('joins selected directory basename to the browsed parent path', () => {
		expect(joinRemotePath('/', 'tv')).toBe('/tv');
		expect(joinRemotePath('/tv', 'Show A')).toBe('/tv/Show A');
	});
});
