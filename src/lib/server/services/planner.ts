import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { getSettings } from './settings';
import { getClientForSource, getLibrary } from './sources';
import { extname, isVideoPath, joinRemote, sidecarExtensions, stripExt } from './paths';
import { targetPathFor } from './naming';
import { parseTvName } from './parser';

type Mode = 'auto' | 'manual';

export async function createPlanForItem(itemId: string, mode: Mode) {
	const db = getSqlite();
	const item = db.prepare('select * from library_items where id = ?').get(itemId) as Record<string, unknown>;
	if (!item) throw new Error('Item not found');
	if (!['identified', 'organized'].includes(String(item.status))) {
		throw new Error('Item must be identified or organized before planning');
	}
	const library = getLibrary(String(item.library_path_id));
	const settings = getSettings();
	const sourceFiles = await listVideoFilesForItem(item);
	const planId = newId();
	const now = nowIso();
	db.prepare(
		`insert into rename_plans (id, library_path_id, mode, status, template_snapshot_json, created_by, confirmed_at, created_at)
		 values (@id, @libraryPathId, @mode, 'confirmed', @templateSnapshotJson, 'web', @confirmedAt, @createdAt)`
	).run({
		id: planId,
		libraryPathId: library.id,
		mode,
		templateSnapshotJson: JSON.stringify(settings),
		confirmedAt: now,
		createdAt: now
	});
	for (const sourceFilePath of sourceFiles) {
		const tv = parseTvName(sourceFilePath);
		const season = library.mediaType === 'tv' ? tv.season || 1 : null;
		const episode = library.mediaType === 'tv' ? tv.episode : null;
		if (library.mediaType === 'tv' && !episode) continue;
		const target = targetPathFor(
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
		);
		db.prepare(
			`insert into rename_plan_items
			 (id, plan_id, library_item_id, source_file_path, target_file_path, target_top_level_path,
			  media_kind, source_media_id, season, episode, overwrite, sidecars_json, status)
			 values (@id, @planId, @libraryItemId, @sourceFilePath, @targetFilePath, @targetTopLevelPath,
			  @mediaKind, @sourceMediaId, @season, @episode, 0, @sidecarsJson, 'pending')`
		).run({
			id: newId(),
			planId,
			libraryItemId: itemId,
			sourceFilePath,
			targetFilePath: target.targetFilePath,
			targetTopLevelPath: target.targetTopLevelPath,
			mediaKind: library.mediaType,
			sourceMediaId: item.source_media_id,
			season,
			episode,
			sidecarsJson: JSON.stringify(await discoverSidecars(sourceFilePath, library.sourceId))
		});
	}
	return getPlan(planId);
}

export function getPlan(planId: string) {
	const plan = getSqlite().prepare('select * from rename_plans where id = ?').get(planId) as
		| Record<string, unknown>
		| undefined;
	if (!plan) throw new Error('Plan not found');
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
