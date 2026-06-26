import { getSqlite } from '$lib/server/db';
import { posterUrl } from './tmdb';
import { getClientForSource, getLibrary } from './sources';
import { isVideoPath, joinRemote } from './paths';
import { parseMovieName, parseTvName } from './parser';
import { ApiError } from '$lib/server/api';

export function listItems(libraryPathId?: string) {
	const rows = (libraryPathId
		? getSqlite()
				.prepare('select * from library_items where library_path_id = ? order by top_level_path')
				.all(libraryPathId)
		: getSqlite().prepare('select * from library_items order by updated_at desc').all()) as Record<
		string,
		unknown
	>[];
	return rows.map(mapItem);
}

export function getItem(id: string) {
	const row = getSqlite().prepare('select * from library_items where id = ?').get(id);
	if (!row) throw new ApiError('item.not_found', 'Library item not found', 404);
	return mapItem(row as Record<string, unknown>);
}

export async function getItemDetail(id: string) {
	const row = getSqlite().prepare('select * from library_items where id = ?').get(id) as
		| Record<string, unknown>
		| undefined;
	if (!row) throw new ApiError('item.not_found', 'Library item not found', 404);
	const item = mapItem(row);
	const library = getLibrary(String(row.library_path_id));
	const client = getClientForSource(library.sourceId);
	const root = joinRemote(library.path, String(row.top_level_path));
	const files = String(row.kind) === 'file'
		? [{
				path: root,
				basename: String(row.top_level_path),
				type: 'file' as const,
				video: isVideoPath(String(row.top_level_path)),
				compliance: classifyVideo(library.mediaType, String(row.top_level_path))
			}]
		: await listDetailEntries(client, root, library.mediaType === 'movie' ? 1 : 2, library.mediaType);
	const executionRecords = getSqlite()
		.prepare(
			`select er.*
			 from execution_records er
			 join rename_plan_items rpi on rpi.id = er.plan_item_id
			 where rpi.library_item_id = ?
			 order by er.created_at desc
			 limit 50`
		)
		.all(id)
		.map((record) => ({
			id: String((record as Record<string, unknown>).id),
			sourcePath: String((record as Record<string, unknown>).source_path),
			targetPath: String((record as Record<string, unknown>).target_path),
			status: String((record as Record<string, unknown>).status),
			error: (record as Record<string, unknown>).error ? String((record as Record<string, unknown>).error) : null,
			context: JSON.parse(String((record as Record<string, unknown>).context_json || '{}')),
			createdAt: String((record as Record<string, unknown>).created_at)
		}));
	return {
		item,
		library,
		files,
		summary: {
			videoFileCount: item.videoFileCount,
			compliantFileCount: item.compliantFileCount,
			nonCompliantFileCount: item.nonCompliantFileCount,
			lastScannedAt: item.lastScannedAt,
			lastExecutionSummary: item.lastExecutionSummary
		},
		executionRecords
	};
}

export function setItemIdentity(
	id: string,
	identity: {
		sourceMediaType: 'movie' | 'tv';
		sourceMediaId: string;
		title: string;
		originalTitle?: string;
		year?: number;
		posterPath?: string;
	}
) {
	getSqlite()
		.prepare(
			`update library_items set
			 status = 'identified', source = 'tmdb', source_media_type = @sourceMediaType,
			 source_media_id = @sourceMediaId, title = @title, original_title = @originalTitle,
			 year = @year, poster_path = @posterPath, confidence = 'manual',
			 review_reason = null, updated_at = @updatedAt
			 where id = @id`
		)
		.run({
			id,
			...identity,
			originalTitle: identity.originalTitle || identity.title,
			year: identity.year || null,
			posterPath: identity.posterPath || null,
			updatedAt: new Date().toISOString()
		});
	return getItem(id);
}

export function mapItem(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		libraryPathId: String(row.library_path_id),
		kind: row.kind as 'folder' | 'file',
		topLevelPath: String(row.top_level_path),
		status: String(row.status),
		source: row.source ? String(row.source) : null,
		sourceMediaType: row.source_media_type ? String(row.source_media_type) : null,
		sourceMediaId: row.source_media_id ? String(row.source_media_id) : null,
		title: row.title ? String(row.title) : null,
		originalTitle: row.original_title ? String(row.original_title) : null,
		year: row.year ? Number(row.year) : null,
		posterPath: row.poster_path ? String(row.poster_path) : null,
		posterUrl: posterUrl(row.poster_path ? String(row.poster_path) : null),
		confidence: row.confidence ? String(row.confidence) : null,
		reviewReason: row.review_reason ? String(row.review_reason) : null,
		recognitionCandidates: row.recognition_candidates_json
			? JSON.parse(String(row.recognition_candidates_json))
			: [],
		videoFileCount: Number(row.video_file_count),
		compliantFileCount: Number(row.compliant_file_count),
		nonCompliantFileCount: Number(row.non_compliant_file_count),
		unknownFileCount: Number(row.unknown_file_count),
		lastScannedAt: row.last_scanned_at ? String(row.last_scanned_at) : null,
		lastInspectedAt: row.last_inspected_at ? String(row.last_inspected_at) : null,
		lastExecutionSummary: row.last_execution_summary_json
			? JSON.parse(String(row.last_execution_summary_json))
			: null
	};
}

async function listDetailEntries(
	client: { listDirectory(path: string): Promise<{ basename: string; type: 'file' | 'directory'; size?: number; lastmod?: string }[]> },
	root: string,
	depth: number,
	mediaType: 'movie' | 'tv'
) {
	const entries: {
		path: string;
		basename: string;
		type: 'file' | 'directory';
		size?: number;
		lastmod?: string;
		video: boolean;
		compliance: ReturnType<typeof classifyVideo>;
	}[] = [];
	async function walk(path: string, remainingDepth: number) {
		const children = await client.listDirectory(path);
		for (const child of children) {
			const fullPath = joinRemote(path, child.basename);
			const video = child.type === 'file' && isVideoPath(child.basename);
			entries.push({
				path: fullPath,
				basename: child.basename,
				type: child.type,
				size: child.size,
				lastmod: child.lastmod,
				video,
				compliance: video ? classifyVideo(mediaType, child.basename) : { state: 'not_video' as const }
			});
			if (child.type === 'directory' && remainingDepth > 0) await walk(fullPath, remainingDepth - 1);
		}
	}
	await walk(root, depth);
	return entries;
}

function classifyVideo(mediaType: 'movie' | 'tv', basename: string) {
	if (!isVideoPath(basename)) return { state: 'not_video' as const };
	if (mediaType === 'movie') {
		const parsed = parseMovieName(basename);
		return parsed.title && parsed.year
			? { state: 'compliant' as const, movie: { title: parsed.title, year: parsed.year } }
			: { state: 'non_compliant' as const };
	}
	const parsed = parseTvName(basename);
	return parsed.title && parsed.season && parsed.episode
		? {
				state: 'compliant' as const,
				tv: { title: parsed.title, season: parsed.season, episode: parsed.episode }
			}
		: { state: 'non_compliant' as const };
}
