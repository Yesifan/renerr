import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { getClientForSource, getLibrary } from './sources';
import { isVideoPath, joinRemote, normalizeRemotePath } from './paths';
import { parseMovieName, parseTvName, normalizeTitle } from './parser';
import { isCompliantVideo } from './compliance';
import { searchTmdb } from './tmdb';
import { log } from './logs';
import { createPlanForItem } from './planner';
import { enqueueTask } from './tasks';
import { ApiError } from '$lib/server/api';

export async function scanLibraryPath(libraryPathId: string) {
	const library = getLibrary(libraryPathId);
	const client = getClientForSource(library.sourceId);
	const root = normalizeRemotePath(library.path);
	const entries = await client.listDirectory(root);
	const topEntries = entries.filter((entry) => entry.type === 'directory' || isVideoPath(entry.basename));
	const seen = new Set(topEntries.map((entry) => entry.basename));
	const db = getSqlite();
	const now = nowIso();

	for (const entry of topEntries) {
		const existing = db
			.prepare('select * from library_items where library_path_id = ? and top_level_path = ?')
			.get(library.id, entry.basename) as Record<string, unknown> | undefined;
		const id = existing ? String(existing.id) : newId();
		if (!existing) {
			db.prepare(
				`insert into library_items
				 (id, library_path_id, kind, top_level_path, status, video_file_count, compliant_file_count,
				  non_compliant_file_count, unknown_file_count, created_at, updated_at)
				 values (@id, @libraryPathId, @kind, @topLevelPath, 'unidentified', 0, 0, 0, 0, @now, @now)`
			).run({
				id,
				libraryPathId: library.id,
				kind: entry.type === 'directory' ? 'folder' : 'file',
				topLevelPath: entry.basename,
				now
			});
		}
		inheritIdentityFromRenameTarget(id);
		const item = db.prepare('select * from library_items where id = ?').get(id) as Record<string, unknown>;
		const status = normalizeLegacyItemStatus(item);
		if (status === 'pending_review') continue;
		if (status === 'identified') continue;
		if (status === 'organized') {
			await refreshItemStats(id);
			continue;
		}
		if (status === 'unidentified') {
			const videos = await refreshItemStats(id);
			if (videos.length === 0) {
				markPending(id, 'no_video', []);
				continue;
			}
			try {
				await recognizeItem(id);
			} catch (error) {
				markPending(id, 'tmdb_error', []);
				log('warn', 'TmdbMatcher', 'TMDB recognition failed for item', {
					libraryItemId: id,
					error: String(error)
				});
			}
			const refreshed = db.prepare('select * from library_items where id = ?').get(id) as Record<string, unknown>;
			if (library.autoOrganize && String(refreshed.status) === 'identified') {
				const plan = await createPlanForItem(id, 'auto');
				enqueueTask('execute_rename_plan', { planId: plan.id });
			}
		}
	}

	const existingRows = db
		.prepare('select id, top_level_path from library_items where library_path_id = ?')
		.all(library.id) as { id: string; top_level_path: string }[];
	for (const row of existingRows) {
		if (!seen.has(row.top_level_path)) {
			db.prepare('delete from library_items where id = ?').run(row.id);
		}
	}
	log('info', 'LibraryScanner', 'Library path scan completed', { libraryPathId, count: seen.size });
}

function inheritIdentityFromRenameTarget(itemId: string) {
	const db = getSqlite();
	const item = db.prepare('select * from library_items where id = ?').get(itemId) as Record<string, unknown> | undefined;
	if (!item || item.source_media_id) return;
	const source = db
		.prepare(
			`select src.*
			 from rename_plan_items rpi
			 join rename_plans rp on rp.id = rpi.plan_id
			 join library_items src on src.id = rpi.library_item_id
			 where rp.library_path_id = @libraryPathId
			   and rp.status = 'executed'
			   and rpi.target_top_level_path = @topLevelPath
			   and src.source_media_id is not null
			 order by rp.created_at desc
			 limit 1`
		)
		.get({
			libraryPathId: String(item.library_path_id),
			topLevelPath: String(item.top_level_path)
		}) as Record<string, unknown> | undefined;
	if (!source) return;
	db.prepare(
		`update library_items set status = 'organized', source = @source,
		 source_media_type = @sourceMediaType, source_media_id = @sourceMediaId,
		 title = @title, original_title = @originalTitle, year = @year,
		 poster_path = @posterPath, confidence = @confidence,
		 review_reason = null, recognition_candidates_json = @candidates,
		 updated_at = @now where id = @id`
	).run({
		id: itemId,
		source: source.source ? String(source.source) : 'tmdb',
		sourceMediaType: source.source_media_type ? String(source.source_media_type) : null,
		sourceMediaId: String(source.source_media_id),
		title: source.title ? String(source.title) : null,
		originalTitle: source.original_title ? String(source.original_title) : source.title ? String(source.title) : null,
		year: source.year ? Number(source.year) : null,
		posterPath: source.poster_path ? String(source.poster_path) : null,
		confidence: source.confidence ? String(source.confidence) : 'manual',
		candidates: source.recognition_candidates_json ? String(source.recognition_candidates_json) : '[]',
		now: nowIso()
	});
}

export async function scanLibraryItem(itemId: string) {
	const db = getSqlite();
	const item = db.prepare('select * from library_items where id = ?').get(itemId) as Record<string, unknown> | undefined;
	if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
	const status = normalizeLegacyItemStatus(item);
	if (status !== 'organized' && status !== 'unidentified') {
		throw new ApiError('item.scan_not_allowed', 'Library item cannot be scanned in its current status', 400, {
			status
		});
	}
	const videos = await refreshItemStats(itemId);
	if (status === 'organized') {
		log('info', 'LibraryScanner', 'Library item scan completed', { libraryItemId: itemId, status });
		return;
	}
	if (videos.length === 0) {
		markPending(itemId, 'no_video', []);
		return;
	}
	try {
		await recognizeItem(itemId);
	} catch (error) {
		markPending(itemId, 'tmdb_error', []);
		log('warn', 'TmdbMatcher', 'TMDB recognition failed for item', {
			libraryItemId: itemId,
			error: String(error)
		});
	}
	log('info', 'LibraryScanner', 'Library item scan completed', { libraryItemId: itemId, status });
}

export async function refreshItemStats(itemId: string) {
	const db = getSqlite();
	const item = db.prepare('select * from library_items where id = ?').get(itemId) as Record<string, unknown>;
	const library = getLibrary(String(item.library_path_id));
	const client = getClientForSource(library.sourceId);
	const itemRoot = joinRemote(library.path, String(item.top_level_path));
	const videos =
		String(item.kind) === 'file'
			? [itemRoot]
			: await collectVideos(client, itemRoot, library.mediaType === 'movie' ? 1 : 2);
	const now = nowIso();
	const compliant = videos.filter((video) => isCompliantVideo(library.mediaType, video)).length;
	db.prepare(
		`update library_items set video_file_count = @videos, unknown_file_count = 0,
		 compliant_file_count = @compliant,
		 non_compliant_file_count = @nonCompliant,
		 last_scanned_at = @now, updated_at = @now where id = @id`
	).run({ id: itemId, videos: videos.length, compliant, nonCompliant: videos.length - compliant, now });
	return videos;
}

export async function recognizeItem(itemId: string) {
	const db = getSqlite();
	const item = db.prepare('select * from library_items where id = ?').get(itemId) as Record<string, unknown>;
	const library = getLibrary(String(item.library_path_id));
	const parsed =
		library.mediaType === 'movie'
			? parseMovieName(String(item.top_level_path))
			: parseTvName(String(item.top_level_path));
	if (!parsed.title) {
		markPending(itemId, 'parse_failed', []);
		return;
	}
	const candidates = await searchTmdb(library.mediaType, parsed.title);
	const normalizedInput = normalizeTitle(parsed.title);
	const exact = candidates.filter(
		(candidate) =>
			normalizeTitle(candidate.title) === normalizedInput ||
			normalizeTitle(candidate.originalTitle) === normalizedInput
	);
	const best = candidates[0];
	if (
		best &&
		exact[0]?.id === best.id &&
		(!parsed.year || !best.year || parsed.year === best.year) &&
		exact.length <= 1
	) {
		db.prepare(
			`update library_items set status = 'identified', source = 'tmdb',
			 source_media_type = @mediaType, source_media_id = @sourceMediaId,
			 title = @title, original_title = @originalTitle, year = @year,
			 poster_path = @posterPath, confidence = 'high', review_reason = null,
			 recognition_candidates_json = @candidates, updated_at = @now where id = @id`
		).run({
			id: itemId,
			mediaType: library.mediaType,
			sourceMediaId: String(best.id),
			title: best.title,
			originalTitle: best.originalTitle,
			year: best.year,
			posterPath: best.posterPath,
			candidates: JSON.stringify(candidates),
			now: nowIso()
		});
		return;
	}
	markPending(itemId, candidates.length ? 'fuzzy' : 'no_match', candidates);
}

async function collectVideos(
	client: { listDirectory(path: string): Promise<{ basename: string; type: string }[]> },
	root: string,
	depth: number
) {
	const videos: string[] = [];
	const entries = await client.listDirectory(root);
	for (const entry of entries) {
		const fullPath = joinRemote(root, entry.basename);
		if (entry.type === 'file' && isVideoPath(entry.basename)) videos.push(fullPath);
		if (entry.type === 'directory' && depth > 0) {
			videos.push(...(await collectVideos(client, fullPath, depth - 1)));
		}
	}
	return videos;
}

function markPending(itemId: string, reason: string, candidates: unknown[]) {
	getSqlite()
		.prepare(
			`update library_items set status = 'pending_review', review_reason = @reason,
			 recognition_candidates_json = @candidates, updated_at = @now where id = @id`
		)
		.run({ id: itemId, reason, candidates: JSON.stringify(candidates), now: nowIso() });
}

function normalizeLegacyItemStatus(item: Record<string, unknown>) {
	if (String(item.status) !== 'failed') return String(item.status);
	const status = item.source_media_id ? 'identified' : 'pending_review';
	getSqlite()
		.prepare(
			`update library_items set status = @status,
			 review_reason = case when @status = 'pending_review' then coalesce(review_reason, 'legacy_failed') else review_reason end,
			 recognition_candidates_json = coalesce(recognition_candidates_json, '[]'),
			 updated_at = @now where id = @id`
		)
		.run({ id: String(item.id), status, now: nowIso() });
	return status;
}
