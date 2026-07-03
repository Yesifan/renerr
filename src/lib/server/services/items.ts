import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { executionRecords, libraryItems, renamePlanItems } from '$lib/server/db/schema';
import { posterUrl } from './tmdb';
import { getClientForSource, getLibrary } from './sources';
import { isVideoPath, joinRemote } from './paths';
import { parseMovieName, parseTvName } from './parser';
import { ApiError } from '$lib/server/api';

type ListItemsOptions = {
	libraryPathId?: string;
	includeEmpty?: boolean;
};

export function listItems(input: string | ListItemsOptions = {}) {
	const options = typeof input === 'string' ? { libraryPathId: input } : input;
	const hideEmpty = !options.includeEmpty;
	const notEmptyFolder = sql`${libraryItems.kind} <> 'folder' or ${libraryItems.videoFileCount} <> 0`;
	if (options.libraryPathId) {
		const baseWhere = eq(libraryItems.libraryPathId, options.libraryPathId);
		const rows = getDb()
			.select()
			.from(libraryItems)
			.where(hideEmpty ? and(baseWhere, notEmptyFolder) : baseWhere)
			.orderBy(asc(libraryItems.topLevelPath))
			.all();
		return rows.map(mapItem);
	}
	const rows = hideEmpty
		? getDb()
				.select()
				.from(libraryItems)
				.where(notEmptyFolder)
				.orderBy(desc(libraryItems.updatedAt))
				.all()
		: getDb().select().from(libraryItems).orderBy(desc(libraryItems.updatedAt)).all();
	return rows.map(mapItem);
}

export function getItem(id: string) {
	const row = getDb().select().from(libraryItems).where(eq(libraryItems.id, id)).get();
	if (!row) throw new ApiError('item.not_found', 'Library item not found', 404);
	return mapItem(row);
}

export async function getItemDetail(id: string) {
	const row = getDb().select().from(libraryItems).where(eq(libraryItems.id, id)).get();
	if (!row) throw new ApiError('item.not_found', 'Library item not found', 404);
	const item = mapItem(row);
	const library = getLibrary(row.libraryPathId);
	const client = getClientForSource(library.sourceId);
	const root = joinRemote(library.path, row.topLevelPath);
	const files =
		row.kind === 'file'
			? [
					{
						path: root,
						basename: row.topLevelPath,
						type: 'file' as const,
						video: isVideoPath(row.topLevelPath),
						compliance: classifyVideo(library.mediaType, row.topLevelPath)
					}
				]
			: await listDetailEntries(
					client,
					root,
					library.mediaType === 'movie' ? 1 : 2,
					library.mediaType
				);
	const records = getDb()
		.select({
			id: executionRecords.id,
			sourcePath: executionRecords.sourcePath,
			targetPath: executionRecords.targetPath,
			status: executionRecords.status,
			error: executionRecords.error,
			contextJson: executionRecords.contextJson,
			createdAt: executionRecords.createdAt
		})
		.from(executionRecords)
		.innerJoin(renamePlanItems, eq(renamePlanItems.id, executionRecords.planItemId))
		.where(eq(renamePlanItems.libraryItemId, id))
		.orderBy(desc(executionRecords.createdAt))
		.limit(50)
		.all()
		.map((record) => ({
			id: record.id,
			sourcePath: record.sourcePath,
			targetPath: record.targetPath,
			status: record.status,
			error: record.error,
			context: JSON.parse(record.contextJson || '{}'),
			createdAt: record.createdAt
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
		executionRecords: records
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
	getDb()
		.update(libraryItems)
		.set({
			status: 'identified',
			source: 'tmdb',
			sourceMediaType: identity.sourceMediaType,
			sourceMediaId: identity.sourceMediaId,
			title: identity.title,
			originalTitle: identity.originalTitle || identity.title,
			year: identity.year || null,
			posterPath: identity.posterPath || null,
			confidence: 'manual',
			reviewReason: null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(libraryItems.id, id))
		.run();
	return getItem(id);
}

export function mapItem(row: typeof libraryItems.$inferSelect) {
	const sourceMediaId = row.sourceMediaId;
	return {
		id: row.id,
		libraryPathId: row.libraryPathId,
		kind: row.kind,
		topLevelPath: row.topLevelPath,
		status: row.status,
		source: row.source,
		sourceMediaType: row.sourceMediaType,
		sourceMediaId,
		title: row.title,
		originalTitle: row.originalTitle,
		year: row.year,
		posterPath: row.posterPath,
		posterUrl: posterUrl(row.posterPath),
		confidence: row.confidence,
		reviewReason: row.reviewReason,
		recognitionCandidates: row.recognitionCandidatesJson
			? JSON.parse(row.recognitionCandidatesJson)
			: [],
		videoFileCount: row.videoFileCount,
		empty: row.kind === 'folder' && row.videoFileCount === 0,
		compliantFileCount: row.compliantFileCount,
		nonCompliantFileCount: row.nonCompliantFileCount,
		unknownFileCount: row.unknownFileCount,
		lastScannedAt: row.lastScannedAt,
		lastInspectedAt: row.lastInspectedAt,
		lastExecutionSummary: row.lastExecutionSummaryJson
			? JSON.parse(row.lastExecutionSummaryJson)
			: null
	};
}

async function listDetailEntries(
	client: {
		listDirectory(
			path: string
		): Promise<{ basename: string; type: 'file' | 'directory'; size?: number; lastmod?: string }[]>;
	},
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
				compliance: video
					? classifyVideo(mediaType, child.basename)
					: { state: 'not_video' as const }
			});
			if (child.type === 'directory' && remainingDepth > 0)
				await walk(fullPath, remainingDepth - 1);
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
