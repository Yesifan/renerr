import { ApiError } from '$lib/server/api';
import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import type { MediaType } from '$lib/schemas/domain';
import { getSettings } from './settings';
import { getClientForSource, getLibrary } from './sources';
import { extname, isVideoPath, joinRemote, sidecarExtensions, stripExt } from './paths';
import { targetPathFor } from './naming';
import { parseTvName } from './parser';
import { enqueueTask } from './tasks';

type Mode = 'auto' | 'manual';

export type DraftRow = {
	id: string;
	selected: boolean;
	sourceFilePath: string;
	targetFilePath: string;
	targetTopLevelPath: string;
	mediaKind: MediaType;
	sourceMediaId: string | null;
	season: number | null;
	episode: number | null;
	overwrite: boolean;
	conflict: boolean;
	conflictAction: 'overwrite' | null;
	sidecars: string[];
	status: 'valid' | 'invalid';
	errorCode: string | null;
};

export async function createPlanForItem(itemId: string, mode: Mode) {
	const db = getSqlite();
	const item = getPlanningItem(itemId);
	if (!['identified', 'organized'].includes(String(item.status))) {
		throw new ApiError('item.plan_not_allowed', 'Item must be identified or organized before planning', 400, {
			status: String(item.status)
		});
	}
	const library = getLibrary(String(item.library_path_id));
	const sourceFiles = await listVideoFilesForItem(item);
	const planId = createConfirmedPlan(library.id, mode, 'worker');
	for (const sourceFilePath of sourceFiles) {
		const row = await buildRow(item, library, sourceFilePath, false);
		if (row.status === 'invalid') continue;
		insertPlanItem(planId, itemId, row);
	}
	return getPlan(planId);
}

export async function createDraftForItem(itemId: string) {
	const item = getPlanningItem(itemId);
	if (!['identified', 'organized', 'failed'].includes(String(item.status))) {
		throw new ApiError('item.plan_not_allowed', 'Item must be identified or organized before planning', 400, {
			status: String(item.status)
		});
	}
	if (!item.source_media_id || !item.title) {
		throw new ApiError('item.plan_not_allowed', 'Item must have an identity before planning', 400, {
			status: String(item.status)
		});
	}
	const library = getLibrary(String(item.library_path_id));
	const sourceFiles = await listVideoFilesForItem(item);
	const rows = await Promise.all(sourceFiles.map((sourceFilePath) => buildRow(item, library, sourceFilePath, true)));
	const now = nowIso();
	const id = newId();
	getSqlite()
		.prepare(
			`insert into rename_plan_drafts
			 (id, library_path_id, library_item_id, mode, status, rows_json, created_at, updated_at, expires_at)
			 values (@id, @libraryPathId, @libraryItemId, 'manual', 'draft', @rowsJson, @createdAt, @updatedAt, @expiresAt)`
		)
		.run({
			id,
			libraryPathId: library.id,
			libraryItemId: itemId,
			rowsJson: JSON.stringify(rows),
			createdAt: now,
			updatedAt: now,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
		});
	return getDraft(id);
}

export async function updateDraft(draftId: string, input: unknown) {
	const draft = getDraftRow(draftId);
	if (draft.status !== 'draft') throw new ApiError('plan.invalid', 'Plan draft is not editable', 400);
	const item = getPlanningItem(String(draft.library_item_id));
	const library = getLibrary(String(draft.library_path_id));
	const rows = parseRows(draft.rows_json);
	const updates = input && typeof input === 'object' && Array.isArray((input as { rows?: unknown }).rows)
		? ((input as { rows: Partial<DraftRow>[] }).rows)
		: [];
	const nextRows = await Promise.all(
		rows.map(async (row) => {
			const update = updates.find((candidate) => candidate.id === row.id);
			if (!update) return row;
			const merged: DraftRow = {
				...row,
				selected: typeof update.selected === 'boolean' ? update.selected : row.selected,
				season: numberOrNull(update.season, row.season),
				episode: numberOrNull(update.episode, row.episode),
				conflictAction: update.conflictAction === 'overwrite' ? 'overwrite' : null,
				overwrite: update.conflictAction === 'overwrite'
			};
			return buildRow(item, library, merged.sourceFilePath, true, merged);
		})
	);
	getSqlite()
		.prepare('update rename_plan_drafts set rows_json = ?, updated_at = ? where id = ?')
		.run(JSON.stringify(nextRows), nowIso(), draftId);
	return getDraft(draftId);
}

export async function submitDraft(draftId: string) {
	const draft = getDraftRow(draftId);
	if (draft.status !== 'draft') throw new ApiError('plan.invalid', 'Plan draft has already been submitted', 400);
	const rows = parseRows(draft.rows_json).filter((row) => row.selected);
	if (rows.length === 0 || rows.some((row) => row.status === 'invalid')) {
		throw new ApiError('plan.invalid', 'Plan draft contains invalid selected rows', 400);
	}
	if (rows.some((row) => row.conflict && row.conflictAction !== 'overwrite')) {
		throw new ApiError('plan.conflict_unresolved', 'Plan draft contains unresolved conflicts', 400);
	}
	const planId = createConfirmedPlan(String(draft.library_path_id), 'manual', 'web');
	for (const row of rows) {
		insertPlanItem(planId, String(draft.library_item_id), row);
	}
	getSqlite()
		.prepare("update rename_plan_drafts set status = 'submitted', updated_at = ? where id = ?")
		.run(nowIso(), draftId);
	const task = enqueueTask('execute_rename_plan', { planId });
	return { plan: getPlan(planId), task };
}

export function getDraft(draftId: string) {
	const draft = getDraftRow(draftId);
	return {
		id: String(draft.id),
		libraryPathId: String(draft.library_path_id),
		libraryItemId: draft.library_item_id ? String(draft.library_item_id) : null,
		mode: String(draft.mode),
		status: String(draft.status),
		rows: parseRows(draft.rows_json),
		createdAt: String(draft.created_at),
		updatedAt: String(draft.updated_at),
		expiresAt: String(draft.expires_at)
	};
}

export function getPlan(planId: string) {
	const plan = getSqlite().prepare('select * from rename_plans where id = ?').get(planId) as
		| Record<string, unknown>
		| undefined;
	if (!plan) throw new ApiError('plan.invalid', 'Plan not found', 404);
	const items = getSqlite().prepare('select * from rename_plan_items where plan_id = ?').all(planId);
	return {
		id: String(plan.id),
		libraryPathId: String(plan.library_path_id),
		mode: String(plan.mode),
		status: String(plan.status),
		items: items.map((row) => ({
			id: String((row as Record<string, unknown>).id),
			sourceFilePath: String((row as Record<string, unknown>).source_file_path),
			targetFilePath: String((row as Record<string, unknown>).target_file_path),
			status: String((row as Record<string, unknown>).status)
		}))
	};
}

async function buildRow(
	item: Record<string, unknown>,
	library: ReturnType<typeof getLibrary>,
	sourceFilePath: string,
	checkConflict: boolean,
	override?: DraftRow
): Promise<DraftRow> {
	const settings = getSettings();
	const parsedTv = parseTvName(sourceFilePath);
	const season = library.mediaType === 'tv' ? (override?.season ?? parsedTv.season ?? 1) : null;
	const episode = library.mediaType === 'tv' ? (override?.episode ?? parsedTv.episode ?? null) : null;
	const status = library.mediaType === 'tv' && !episode ? 'invalid' : 'valid';
	const target =
		status === 'valid'
			? targetPathFor(
					library.path,
					library.mediaType,
					sourceFilePath,
					{
						title: String(item.title),
						year: item.year ? Number(item.year) : undefined,
						season,
						episode,
						extension: extname(sourceFilePath)
					},
					settings
				)
			: { targetFilePath: '', targetTopLevelPath: '' };
	const conflict = checkConflict && target.targetFilePath ? await getClientForSource(library.sourceId).exists(target.targetFilePath) : false;
	const conflictAction = override?.conflictAction === 'overwrite' ? 'overwrite' : null;
	return {
		id: override?.id ?? newId(),
		selected: override?.selected ?? status === 'valid',
		sourceFilePath,
		targetFilePath: target.targetFilePath,
		targetTopLevelPath: target.targetTopLevelPath,
		mediaKind: library.mediaType,
		sourceMediaId: item.source_media_id ? String(item.source_media_id) : null,
		season,
		episode,
		overwrite: conflictAction === 'overwrite',
		conflict,
		conflictAction,
		sidecars: await discoverSidecars(sourceFilePath, library.sourceId),
		status,
		errorCode: status === 'invalid' ? 'plan.invalid' : null
	};
}

function createConfirmedPlan(libraryPathId: string, mode: Mode, createdBy: string) {
	const id = newId();
	const now = nowIso();
	getSqlite()
		.prepare(
			`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
			 values (@id, @libraryPathId, @mode, 'confirmed', @templateSnapshotJson, @createdBy, @confirmedAt, @createdAt)`
		)
		.run({
			id,
			libraryPathId,
			mode,
			templateSnapshotJson: JSON.stringify(getSettings()),
			createdBy,
			confirmedAt: now,
			createdAt: now
		});
	return id;
}

function insertPlanItem(planId: string, itemId: string, row: DraftRow) {
	getSqlite()
		.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values (@id, @planId, @libraryItemId, @sourceFilePath, @targetFilePath, @targetTopLevelPath,
			  @mediaKind, @sourceMediaId, @season, @episode, @overwrite, @sidecarsJson, 'pending')`
		)
		.run({
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
			overwrite: row.overwrite ? 1 : 0,
			sidecarsJson: JSON.stringify(row.sidecars)
		});
}

function getPlanningItem(itemId: string) {
	const item = getSqlite().prepare('select * from library_items where id = ?').get(itemId) as
		| Record<string, unknown>
		| undefined;
	if (!item) throw new ApiError('item.not_found', 'Library item not found', 404);
	return item;
}

function getDraftRow(draftId: string) {
	const draft = getSqlite().prepare('select * from rename_plan_drafts where id = ?').get(draftId) as
		| Record<string, string>
		| undefined;
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

async function listVideoFilesForItem(item: Record<string, unknown>) {
	const library = getLibrary(String(item.library_path_id));
	const itemRoot = joinRemote(library.path, String(item.top_level_path));
	if (String(item.kind) === 'file') return [itemRoot];
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
