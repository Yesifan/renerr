export type AsyncComboboxStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type AsyncComboboxState<T> = {
	loading: boolean;
	loaded: boolean;
	error: string;
	options: T[];
};

export function asyncComboboxStatus<T>(
	state: AsyncComboboxState<T>,
	filteredOptions: T[] = state.options
): AsyncComboboxStatus {
	if (state.loading) return 'loading';
	if (state.error) return 'error';
	if (!state.loaded) return 'idle';
	return filteredOptions.length ? 'ready' : 'empty';
}
