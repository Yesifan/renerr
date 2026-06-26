import { getSqlite } from '$lib/server/db';
import { posterUrl } from './tmdb';

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
	if (!row) throw new Error('Item not found');
	return mapItem(row as Record<string, unknown>);
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
