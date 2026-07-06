export type DirectorySuggestion = {
	basename: string;
	type: 'directory';
};

export function pathQueryParts(input: string) {
	const raw = input.trim();
	if (!raw || raw === '/') return { parentPath: '/', basename: '' };
	const normalized = raw.startsWith('/')
		? raw.replace(/\/+/g, '/')
		: `/${raw.replace(/\/+/g, '/')}`;
	if (normalized.endsWith('/')) {
		return { parentPath: normalizeDirectory(normalized), basename: '' };
	}
	const index = normalized.lastIndexOf('/');
	return {
		parentPath: index <= 0 ? '/' : normalizeDirectory(normalized.slice(0, index)),
		basename: normalized.slice(index + 1)
	};
}

export function joinRemotePath(parentPath: string, basename: string) {
	return parentPath === '/' ? `/${basename}` : `${parentPath}/${basename}`;
}

export function filterDirectorySuggestions(
	options: DirectorySuggestion[],
	basenameFilter: string,
	limit = 12
) {
	const filter = basenameFilter.toLocaleLowerCase();
	return options
		.filter((option) => option.basename.toLocaleLowerCase().includes(filter))
		.slice(0, limit);
}

function normalizeDirectory(path: string) {
	const normalized = path.replace(/\/+/g, '/');
	return normalized === '/' ? '/' : normalized.replace(/\/+$/, '');
}
