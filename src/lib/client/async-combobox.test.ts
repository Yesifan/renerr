import { describe, expect, test } from 'vitest';
import { asyncComboboxStatus } from './async-combobox';

describe('async combobox state', () => {
	test('reports loading before other states', () => {
		expect(
			asyncComboboxStatus({
				loading: true,
				loaded: true,
				error: 'failed',
				options: ['a']
			})
		).toBe('loading');
	});

	test('reports idle before the first load completes', () => {
		expect(
			asyncComboboxStatus({
				loading: false,
				loaded: false,
				error: '',
				options: []
			})
		).toBe('idle');
	});

	test('reports error, empty, and ready states', () => {
		expect(
			asyncComboboxStatus({
				loading: false,
				loaded: false,
				error: 'failed',
				options: []
			})
		).toBe('error');

		expect(
			asyncComboboxStatus({
				loading: false,
				loaded: true,
				error: '',
				options: ['a']
			})
		).toBe('ready');

		expect(
			asyncComboboxStatus(
				{
					loading: false,
					loaded: true,
					error: '',
					options: ['a']
				},
				[]
			)
		).toBe('empty');
	});
});
