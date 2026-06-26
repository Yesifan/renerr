import path from 'node:path/posix';

export const videoExtensions = new Set(['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.ts', '.m2ts', '.wmv']);
export const sidecarExtensions = new Set(['.srt', '.ass', '.ssa', '.vtt', '.sub', '.nfo']);

export function normalizeRemotePath(input: string) {
	const trimmed = input.trim();
	const joined = path.normalize(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
	return joined === '/' ? '/' : joined.replace(/\/+$/, '');
}

export function joinRemote(...parts: string[]) {
	return normalizeRemotePath(path.join(...parts));
}

export function basename(value: string) {
	return path.basename(value);
}

export function dirname(value: string) {
	return path.dirname(value);
}

export function extname(value: string) {
	return path.extname(value).toLowerCase();
}

export function stripExt(value: string) {
	const ext = path.extname(value);
	return ext ? value.slice(0, -ext.length) : value;
}

export function isVideoPath(value: string) {
	return videoExtensions.has(extname(value));
}

export function sanitizeSegment(input: string) {
	const cleaned = input
		.normalize('NFKC')
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[\s.]+$/g, '');
	return cleaned || 'Untitled';
}

export function displayPath(sourceName: string, libraryPath: string, topLevelPath?: string) {
	return `/${sourceName}${normalizeRemotePath(libraryPath)}${topLevelPath ? `/${topLevelPath}` : ''}`;
}
