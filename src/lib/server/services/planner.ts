import { ApiError } from '$lib/server/api';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import {
	libraryItems,
	renamePlanDrafts,
	renamePlanItems,
	renamePlans
} from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import type { MediaType } from '$lib/schemas/domain';
import { getSettings } from './settings';
import { getClientForSource, getLibrary } from './sources';
import { extname, isVideoPath, joinRemote, sidecarExtensions, stripExt } from './paths';
import { targetPathFor } from './naming';
import { parseTvName } from './parser';
import { enqueueTask } from './tasks';
import { createTaskRecorder } from './task-recorder';
import { posterUrl } from './tmdb';

type Mode = 'auto' | 'manual';
type PlanningItem = typeof libraryItems.$inferSelect;

export type DraftRow = {
	id: string;
	selected: boolean;
	sourceFilePath: string;
	targetFilePath: string;
	targetTopLevelPath: string;
	mediaKind: MediaType;
	sourceMediaId: string | null;
	title: string;
	originalTitle: string;
	year: number | null;
	posterPath: string | null;
	posterUrl: string | null;
	season: number | null;
	episode: number | null;
	overwrite: boolean;
	conflict: boolean;
	conflictAction: 'overwrite' | null;
	noop: boolean;
	sidecars: string[];
	status: 'valid' | 'invalid';
	errorCode: string | null;
};

export async function createPlanForItem(itemId: string, mode: Mode) {
	const result = await createConfirmedRenamePlanForItem(itemId, mode, 'worker');
	if (!result.plan) {
		throw new ApiError(
			'plan.noop',
			'No executable rename plan rows were found',
			400,
			result.summary
		);
	}
	return result.plan;
}

export async function runCreateRenamePlanForItemTask(taskId: string, itemId: string) {
	const recorder = createTaskRecorder(taskId, { component: 'RenamePlanner' }, 'worker');
	const result = await createConfirmedRenamePlanForItem(itemId, 'auto', 'worker');
	const summary: Record<string, unknown> = {
		itemId,
		...result.summary,
		autoExecute: false,
		executionTaskId: null
	};
	if (!result.plan) {
		recorder.info(`${result.item.topLevelPath} has no executable rename plan rows`);
		return summary;
	}
	recorder.info(`${result.item.topLevelPath} rename plan ${result.plan.id} created`);
	const autoExecute = result.library.autoOrganize;
	summary.planId = result.plan.id;
	summary.autoExecute = autoExecute;
	if (autoExecute) {
		const task = enqueueTask('execute_rename_plan', { planId: result.plan.id });
		summary.executionTaskId = task.id;
		recorder.info(`${result.item.topLevelPath} rename plan ${result.plan.id} queued for execution`);
	}
	return summary;
}

async function createConfirmedRenamePlanForItem(itemId: string, mode: Mode, createdBy: string) {
	const item = getPlanningItem(itemId);
	if (!['identified', 'organized'].includes(item.status)) {
		throw new ApiError(
			'item.plan_not_allowed',
			'Item must be identified or organized before planning',
			400,
			{
				status: item.status
			}
		);
	}
	const library = getLibrary(item.libraryPathId);
	const sourceFiles = await listVideoFilesForItem(item);
	const rows = await Promise.all(
		sourceFiles.map((sourceFilePath) => buildRow(item, library, sourceFilePath, false))
	);
	const executableRows = rows.filter((row) => row.status !== 'invalid' && !row.noop);
	const invalidRows = rows.filter((row) => row.status === 'invalid').length;
	const noopRows = rows.filter((row) => row.noop).length;
	const summary = {
		planId: null as string | null,
		executableRows: executableRows.length,
		noopRows,
		invalidRows,
		totalRows: rows.length
	};
	if (!executableRows.length) {
		return { item, library, plan: null, summary };
	}
	const planId = createConfirmedPlan(library.id, mode, createdBy);
	summary.planId = planId;
	for (const row of executableRows) {
		insertPlanItem(planId, itemId, row);
	}
	return { item, library, plan: getPlan(planId), summary };
}

export async function createDraftForItem(itemId: string) {
	const item = getPlanningItem(itemId);
	if (!['identified', 'organized'].includes(item.status)) {
		throw new ApiError(
			'item.plan_not_allowed',
			'Item must be identified or organized before planning',
			400,
			{
				status: item.status
			}
		);
	}
	if (!item.sourceMediaId || !item.title) {
		throw new ApiError('item.plan_not_allowed', 'Item must have an identity before planning', 400, {
			status: item.status
		});
	}
	const library = getLibrary(item.libraryPathId);
	const sourceFiles = await listVideoFilesForItem(item);
	const rows = await Promise.all(
		sourceFiles.map((sourceFilePath) => buildRow(item, library, sourceFilePath, true))
	);
	const now = nowIso();
	const id = newId();
	getDb()
		.insert(renamePlanDrafts)
		.values({
			id,
			libraryPathId: library.id,
			libraryItemId: itemId,
			mode: 'manual',
			status: 'draft',
			rowsJson: JSON.stringify(rows),
			createdAt: now,
			updatedAt: now,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
		})
		.run();
	return getDraft(id);
}

export async function updateDraft(draftId: string, input: unknown) {
	const draft = getDraftRow(draftId);
	if (draft.status !== 'draft')
		throw new ApiError('plan.invalid', 'Plan draft is not editable', 400);
	const item = getPlanningItem(String(draft.libraryItemId));
	const library = getLibrary(draft.libraryPathId);
	const rows = parseRows(draft.rowsJson);
	const updates =
		input && typeof input === 'object' && Array.isArray((input as { rows?: unknown }).rows)
			? (input as { rows: Partial<DraftRow>[] }).rows
			: [];
	const nextRows = await Promise.all(
		rows.map(async (row) => {
			const update = updates.find((candidate) => candidate.id === row.id);
			if (!update) return row;
			const nextPosterPath = nullableString(update.posterPath, row.posterPath);
			const merged: DraftRow = {
				...row,
				selected: typeof update.selected === 'boolean' ? update.selected : row.selected,
				season: numberOrNull(update.season, row.season),
				episode: numberOrNull(update.episode, row.episode),
				sourceMediaId: stringOrFallback(update.sourceMediaId, row.sourceMediaId),
				title: requiredString(update.title, row.title),
				originalTitle: requiredString(update.originalTitle, row.originalTitle),
				year: numberOrNull(update.year, row.year),
				posterPath: nextPosterPath,
				posterUrl:
					'posterUrl' in update
						? nullableString(update.posterUrl, row.posterUrl)
						: posterUrl(nextPosterPath),
				conflictAction: update.conflictAction === 'overwrite' ? 'overwrite' : null,
				overwrite: update.conflictAction === 'overwrite'
			};
			return buildRow(item, library, merged.sourceFilePath, true, merged);
		})
	);
	getDb()
		.update(renamePlanDrafts)
		.set({ rowsJson: JSON.stringify(nextRows), updatedAt: nowIso() })
		.where(eq(renamePlanDrafts.id, draftId))
		.run();
	return getDraft(draftId);
}

export async function submitDraft(draftId: string) {
	const draft = getDraftRow(draftId);
	if (draft.status !== 'draft')
		throw new ApiError('plan.invalid', 'Plan draft has already been submitted', 400);
	const rows = parseRows(draft.rowsJson).filter((row) => row.selected && !row.noop);
	if (rows.length === 0 || rows.some((row) => row.status === 'invalid')) {
		throw new ApiError('plan.invalid', 'Plan draft contains invalid selected rows', 400);
	}
	if (rows.some((row) => row.conflict && row.conflictAction !== 'overwrite')) {
		throw new ApiError('plan.conflict_unresolved', 'Plan draft contains unresolved conflicts', 400);
	}
	const planId = createConfirmedPlan(draft.libraryPathId, 'manual', 'web');
	for (const row of rows) {
		insertPlanItem(planId, String(draft.libraryItemId), row);
	}
	getDb()
		.update(renamePlanDrafts)
		.set({ status: 'submitted', updatedAt: nowIso() })
		.where(eq(renamePlanDrafts.id, draftId))
		.run();
	const task = enqueueTask('execute_rename_plan', { planId });
	return { plan: getPlan(planId), task };
}

export function getDraft(draftId: string) {
	const draft = getDraftRow(draftId);
	return {
		id: draft.id,
		libraryPathId: draft.libraryPathId,
		libraryItemId: draft.libraryItemId,
		mode: draft.mode,
		status: draft.status,
		rows: parseRows(draft.rowsJson),
		createdAt: draft.createdAt,
		updatedAt: draft.updatedAt,
		expiresAt: draft.expiresAt
	};
}

export function getPlan(planId: string) {
	const plan = getDb().select().from(renamePlans).where(eq(renamePlans.id, planId)).get();
	if (!plan) throw new ApiError('plan.invalid', 'Plan not found', 404);
	const items = getDb()
		.select()
		.from(renamePlanItems)
		.where(eq(renamePlanItems.planId, planId))
		.all();
	return {
		id: plan.id,
		libraryPathId: plan.libraryPathId,
		mode: plan.mode,
		status: plan.status,
		items: items.map((row) => ({
			id: row.id,
			sourceFilePath: row.sourceFilePath,
			targetFilePath: row.targetFilePath,
			status: row.status
		}))
	};
}

export function getConfirmedPlanForItem(itemId: string) {
	const rows = getDb()
		.select({
			id: renamePlans.id,
			libraryPathId: renamePlans.libraryPathId,
			mode: renamePlans.mode,
			status: renamePlans.status,
			createdAt: renamePlans.createdAt
		})
		.from(renamePlanItems)
		.innerJoin(renamePlans, eq(renamePlans.id, renamePlanItems.planId))
		.where(and(eq(renamePlanItems.libraryItemId, itemId), eq(renamePlans.status, 'confirmed')))
		.orderBy(desc(renamePlans.createdAt))
		.all();
	const plan = rows[0];
	if (!plan) return null;
	return {
		...plan,
		itemCount: rows.filter((row) => row.id === plan.id).length
	};
}

async function buildRow(
	item: PlanningItem,
	library: ReturnType<typeof getLibrary>,
	sourceFilePath: string,
	checkConflict: boolean,
	override?: DraftRow
): Promise<DraftRow> {
	const settings = getSettings();
	const parsedTv = parseTvName(sourceFilePath);
	const season = library.mediaType === 'tv' ? (override?.season ?? parsedTv.season ?? 1) : null;
	const episode =
		library.mediaType === 'tv' ? (override?.episode ?? parsedTv.episode ?? null) : null;
	const status = library.mediaType === 'tv' && !episode ? 'invalid' : 'valid';
	const media = mediaInfo(item, override);
	const target =
		status === 'valid'
			? targetPathFor(
					effectiveOrganizeRoot(library),
					library.mediaType,
					sourceFilePath,
					{
						title: media.title,
						year: media.year ?? undefined,
						season,
						episode,
						extension: extname(sourceFilePath)
					},
					settings
				)
			: { targetFilePath: '', targetTopLevelPath: '' };
	const noop = status === 'valid' && target.targetFilePath === sourceFilePath;
	const conflict =
		checkConflict && target.targetFilePath && !noop
			? await getClientForSource(library.sourceId).exists(target.targetFilePath)
			: false;
	const conflictAction = override?.conflictAction === 'overwrite' ? 'overwrite' : null;
	return {
		id: override?.id ?? newId(),
		selected: noop ? false : (override?.selected ?? status === 'valid'),
		sourceFilePath,
		targetFilePath: target.targetFilePath,
		targetTopLevelPath: target.targetTopLevelPath,
		mediaKind: library.mediaType,
		sourceMediaId: media.sourceMediaId,
		title: media.title,
		originalTitle: media.originalTitle,
		year: media.year,
		posterPath: media.posterPath,
		posterUrl: media.posterUrl,
		season,
		episode,
		overwrite: conflictAction === 'overwrite',
		conflict,
		conflictAction,
		noop,
		sidecars: await discoverSidecars(sourceFilePath, library.sourceId),
		status,
		errorCode: status === 'invalid' ? 'plan.invalid' : null
	};
}

function effectiveOrganizeRoot(library: { path: string; organizeTargetPath?: string | null }) {
	return library.organizeTargetPath ?? library.path;
}

function createConfirmedPlan(libraryPathId: string, mode: Mode, createdBy: string) {
	const id = newId();
	const now = nowIso();
	getDb()
		.insert(renamePlans)
		.values({
			id,
			libraryPathId,
			mode,
			status: 'confirmed',
			templateSnapshotJson: JSON.stringify(getSettings()),
			createdBy,
			confirmedAt: now,
			createdAt: now
		})
		.run();
	return id;
}

function insertPlanItem(planId: string, itemId: string, row: DraftRow) {
	getDb()
		.insert(renamePlanItems)
		.values({
			id: newId(),
			planId,
			libraryItemId: itemId,
			sourceFilePath: row.sourceFilePath,
			targetFilePath: row.targetFilePath,
			targetTopLevelPath: row.targetTopLevelPath,
			mediaKind: row.mediaKind,
			sourceMediaId: row.sourceMediaId,
			season: row.season,
			episode: row.episode,
			overwrite: row.overwrite,
			sidecarsJson: JSON.stringify(row.sidecars),
			status: 'pending'
		})
		.run();
}

function getPlanningItem(itemId: string) {
	const item = getDb().select().from(libraryItems).where(eq(libraryItems.id, itemId)).get();
	if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
	return item;
}

function getDraftRow(draftId: string) {
	const draft = getDb()
		.select()
		.from(renamePlanDrafts)
		.where(eq(renamePlanDrafts.id, draftId))
		.get();
	if (!draft) throw new ApiError('plan.invalid', 'Plan draft not found', 404);
	return draft;
}

function parseRows(value: unknown): DraftRow[] {
	return JSON.parse(String(value || '[]')) as DraftRow[];
}

function numberOrNull(value: unknown, fallback: number | null) {
	if (value === null) return null;
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : fallback;
}

function stringOrFallback(value: unknown, fallback: string | null): string | null {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	return trimmed ? trimmed : fallback;
}

function requiredString(value: unknown, fallback: string): string {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	return trimmed || fallback;
}

function nullableString(value: unknown, fallback: string | null): string | null {
	if (value === null) return null;
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	return trimmed || null;
}

function mediaInfo(item: PlanningItem, override?: DraftRow) {
	const posterPath = override?.posterPath ?? item.posterPath;
	return {
		sourceMediaId: override?.sourceMediaId ?? item.sourceMediaId,
		title: override?.title || String(item.title),
		originalTitle: override?.originalTitle || item.originalTitle || String(item.title),
		year: override?.year ?? item.year,
		posterPath,
		posterUrl: override?.posterUrl ?? posterUrl(posterPath)
	};
}

async function listVideoFilesForItem(item: PlanningItem) {
	const library = getLibrary(item.libraryPathId);
	const itemRoot = joinRemote(library.path, item.topLevelPath);
	if (item.kind === 'file') return [itemRoot];
	const client = getClientForSource(library.sourceId);
	const videos: string[] = [];
	async function walk(root: string, depth: number) {
		const entries = await client.listDirectory(root);
		for (const entry of entries) {
			const fullPath = joinRemote(root, entry.basename);
			if (entry.type === 'file' && isVideoPath(entry.basename)) videos.push(fullPath);
			if (entry.type === 'directory' && depth > 0) await walk(fullPath, depth - 1);
		}
	}
	await walk(itemRoot, library.mediaType === 'movie' ? 1 : 2);
	return videos;
}

async function discoverSidecars(sourceFilePath: string, sourceId: string) {
	const client = getClientForSource(sourceId);
	const base = stripExt(sourceFilePath);
	const found: string[] = [];
	for (const extension of sidecarExtensions) {
		const candidate = `${base}${extension}`;
		if (await client.exists(candidate)) found.push(candidate);
	}
	return found;
}
