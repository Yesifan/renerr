import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { libraryItems, renamePlanItems, renamePlans } from '$lib/server/db/schema';
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

type LibraryItem = typeof libraryItems.$inferSelect;

export async function scanLibraryPath(libraryPathId: string) {
	const library = getLibrary(libraryPathId);
	const client = getClientForSource(library.sourceId);
	const root = normalizeRemotePath(library.path);
	const entries = await client.listDirectory(root);
	const topEntries = entries.filter(
		(entry) => entry.type === 'directory' || isVideoPath(entry.basename)
	);
	const seen = new Set(topEntries.map((entry) => entry.basename));
	const db = getDb();
	const now = nowIso();

	for (const entry of topEntries) {
		const existing = db
			.select()
			.from(libraryItems)
			.where(
				and(
					eq(libraryItems.libraryPathId, library.id),
					eq(libraryItems.topLevelPath, entry.basename)
				)
			)
			.get();
		const id = existing ? existing.id : newId();
		if (!existing) {
			db.insert(libraryItems)
				.values({
					id,
					libraryPathId: library.id,
					kind: entry.type === 'directory' ? 'folder' : 'file',
					topLevelPath: entry.basename,
					status: 'unidentified',
					videoFileCount: 0,
					compliantFileCount: 0,
					nonCompliantFileCount: 0,
					unknownFileCount: 0,
					createdAt: now,
					updatedAt: now
				})
				.run();
		}
		inheritIdentityFromRenameTarget(id);
		const item = getLibraryItem(id);
		const status = item.status;
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
			const refreshed = getLibraryItem(id);
			if (library.autoOrganize && refreshed.status === 'identified') {
				const plan = await createPlanForItem(id, 'auto');
				enqueueTask('execute_rename_plan', { planId: plan.id });
			}
		}
	}

	const existingRows = db
		.select({ id: libraryItems.id, topLevelPath: libraryItems.topLevelPath })
		.from(libraryItems)
		.where(eq(libraryItems.libraryPathId, library.id))
		.all();
	for (const row of existingRows) {
		if (!seen.has(row.topLevelPath)) {
			db.delete(libraryItems).where(eq(libraryItems.id, row.id)).run();
		}
	}
	log('info', 'LibraryScanner', 'Library path scan completed', { libraryPathId, count: seen.size });
}

function inheritIdentityFromRenameTarget(itemId: string) {
	const db = getDb();
	const item = db.select().from(libraryItems).where(eq(libraryItems.id, itemId)).get();
	if (!item || item.sourceMediaId) return;
	const source = db
		.select({ source: libraryItems })
		.from(renamePlanItems)
		.innerJoin(renamePlans, eq(renamePlans.id, renamePlanItems.planId))
		.innerJoin(libraryItems, eq(libraryItems.id, renamePlanItems.libraryItemId))
		.where(
			and(
				eq(renamePlans.libraryPathId, item.libraryPathId),
				eq(renamePlans.status, 'executed'),
				eq(renamePlanItems.targetTopLevelPath, item.topLevelPath),
				isNotNull(libraryItems.sourceMediaId)
			)
		)
		.orderBy(desc(renamePlans.createdAt))
		.limit(1)
		.get()?.source;
	if (!source) return;
	db.update(libraryItems)
		.set({
			status: 'organized',
			source: source.source ?? 'tmdb',
			sourceMediaType: source.sourceMediaType,
			sourceMediaId: source.sourceMediaId,
			title: source.title,
			originalTitle: source.originalTitle ?? source.title,
			year: source.year,
			posterPath: source.posterPath,
			confidence: source.confidence ?? 'manual',
			reviewReason: null,
			recognitionCandidatesJson: source.recognitionCandidatesJson ?? '[]',
			updatedAt: nowIso()
		})
		.where(eq(libraryItems.id, itemId))
		.run();
}

export async function scanLibraryItem(itemId: string) {
	const item = getDb().select().from(libraryItems).where(eq(libraryItems.id, itemId)).get();
	if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
	const status = item.status;
	if (status !== 'organized' && status !== 'unidentified') {
		throw new ApiError(
			'item.scan_not_allowed',
			'Library item cannot be scanned in its current status',
			400,
			{
				status
			}
		);
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
	const db = getDb();
	const item = getLibraryItem(itemId);
	const library = getLibrary(item.libraryPathId);
	const client = getClientForSource(library.sourceId);
	const itemRoot = joinRemote(library.path, item.topLevelPath);
	const videos =
		item.kind === 'file'
			? [itemRoot]
			: await collectVideos(client, itemRoot, library.mediaType === 'movie' ? 1 : 2);
	const now = nowIso();
	const compliant = videos.filter((video) => isCompliantVideo(library.mediaType, video)).length;
	db.update(libraryItems)
		.set({
			videoFileCount: videos.length,
			unknownFileCount: 0,
			compliantFileCount: compliant,
			nonCompliantFileCount: videos.length - compliant,
			lastScannedAt: now,
			updatedAt: now
		})
		.where(eq(libraryItems.id, itemId))
		.run();
	return videos;
}

export async function recognizeItem(itemId: string) {
	const db = getDb();
	const item = getLibraryItem(itemId);
	const library = getLibrary(item.libraryPathId);
	const parsed =
		library.mediaType === 'movie'
			? parseMovieName(item.topLevelPath)
			: parseTvName(item.topLevelPath);
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
		db.update(libraryItems)
			.set({
				status: 'identified',
				source: 'tmdb',
				sourceMediaType: library.mediaType,
				sourceMediaId: String(best.id),
				title: best.title,
				originalTitle: best.originalTitle,
				year: best.year,
				posterPath: best.posterPath,
				confidence: 'high',
				reviewReason: null,
				recognitionCandidatesJson: JSON.stringify(candidates),
				updatedAt: nowIso()
			})
			.where(eq(libraryItems.id, itemId))
			.run();
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
	getDb()
		.update(libraryItems)
		.set({
			status: 'pending_review',
			reviewReason: reason,
			recognitionCandidatesJson: JSON.stringify(candidates),
			updatedAt: nowIso()
		})
		.where(eq(libraryItems.id, itemId))
		.run();
}

function getLibraryItem(itemId: string): LibraryItem {
	const item = getDb().select().from(libraryItems).where(eq(libraryItems.id, itemId)).get();
	if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
	return item;
}
