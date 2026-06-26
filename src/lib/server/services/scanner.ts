import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { getClientForSource, getLibrary } from './sources';
import { isVideoPath, joinRemote, normalizeRemotePath } from './paths';
import { parseMovieName, parseTvName, normalizeTitle } from './parser';
import { searchTmdb } from './tmdb';
import { log } from './logs';
import { createPlanForItem } from './planner';
import { enqueueTask } from './tasks';

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
		const item = db.prepare('select * from library_items where id = ?').get(id) as Record<string, unknown>;
		const videos = await refreshItemStats(id);
		if (videos.length === 0) {
			markPending(id, 'no_video', []);
			continue;
		}
		if (String(item.status) === 'unidentified') {
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
	db.prepare(
		`update library_items set video_file_count = @videos, unknown_file_count = 0,
		 compliant_file_count = case when status = 'organized' then @videos else 0 end,
		 non_compliant_file_count = case when status = 'organized' then 0 else @videos end,
		 last_scanned_at = @now, updated_at = @now where id = @id`
	).run({ id: itemId, videos: videos.length, now });
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
