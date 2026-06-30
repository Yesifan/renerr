import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { basename, dirname, joinRemote, sidecarExtensions, stripExt } from './paths';
import { getClientForSource, getLibrary } from './sources';
import { log } from './logs';
import { metadataTargets } from './naming';
import { getSettings } from './settings';
import { isCompliantVideo } from './compliance';

type ItemExecutionSummary = {
	ok: number;
	failed: number;
	succeededTargets: string[];
};

export async function executeRenamePlan(taskId: string, planId: string) {
	const db = getSqlite();
	const plan = db.prepare('select * from rename_plans where id = ?').get(planId) as Record<string, unknown>;
	if (!plan) throw new Error('Plan not found');
	const library = getLibrary(String(plan.library_path_id));
	const client = getClientForSource(library.sourceId);
	const rows = db.prepare('select * from rename_plan_items where plan_id = ?').all(planId) as Record<
		string,
		unknown
	>[];
	let ok = 0;
	let failed = 0;
	const itemSummaries = new Map<string, ItemExecutionSummary>();
	const metadataDone = new Set<string>();
	for (const row of rows) {
		const itemId = String(row.library_item_id);
		const originalSource = String(row.source_file_path);
		let source = originalSource;
		const target = String(row.target_file_path);
		const warnings: Record<string, unknown>[] = [];
		try {
			if (!(await client.exists(source))) {
				const intermediate = intermediateMovePath(source, target);
				if (intermediate && (await client.exists(intermediate))) {
					warnings.push({ type: 'resumed_intermediate_move', originalSource: source, intermediate });
					source = intermediate;
				} else {
					throw new Error('Source file no longer exists');
				}
			}
			const overwrite = String(plan.mode) === 'manual' && Boolean(row.overwrite);
			if (!overwrite && (await client.exists(target))) throw new Error('Target file exists');
			await client.ensureDirectory(dirname(target));
			await client.moveFile(source, target, { overwrite });
			const sidecars = await discoverExistingSidecars(client, originalSource);
			for (const sidecar of sidecars) {
				try {
					if (await client.exists(sidecar)) {
						await client.moveFile(sidecar, joinRemote(dirname(target), sidecar.split('/').at(-1) || ''), {
							overwrite
						});
					}
				} catch (error) {
					warnings.push({ type: 'sidecar_move_failed', sidecar, error: String(error) });
					log('warn', 'RenameExecutor', 'Sidecar move failed', { sidecar, error: String(error) });
				}
			}
			try {
				await writeMetadataOnce(client, target, library.mediaType, metadataDone);
			} catch (error) {
				warnings.push({ type: 'metadata_write_failed', target, error: String(error) });
				log('warn', 'RenameExecutor', 'Metadata write failed', { target, error: String(error) });
			}
			db.prepare("update rename_plan_items set status = 'succeeded' where id = ?").run(row.id);
			db.prepare(
				`insert into execution_records
				 (id, task_id, plan_item_id, source_path, target_path, status, context_json, created_at)
				 values (?, ?, ?, ?, ?, 'succeeded', ?, ?)`
			).run(newId(), taskId, row.id, source, target, JSON.stringify({ warnings, overwritten: Boolean(overwrite) }), nowIso());
			ok += 1;
			const summary = summaryFor(itemSummaries, itemId);
			summary.ok += 1;
			summary.succeededTargets.push(target);
		} catch (error) {
			db.prepare("update rename_plan_items set status = 'failed' where id = ?").run(row.id);
			db.prepare(
				`insert into execution_records
				 (id, task_id, plan_item_id, source_path, target_path, status, error, context_json, created_at)
			 values (?, ?, ?, ?, ?, 'failed', ?, ?, ?)`
			).run(newId(), taskId, row.id, source, target, String(error), JSON.stringify({ error: String(error) }), nowIso());
			failed += 1;
			summaryFor(itemSummaries, itemId).failed += 1;
		}
	}
	const itemIds = [...new Set(rows.map((row) => String(row.library_item_id)))];
	for (const itemId of itemIds) {
		const summary = itemSummaries.get(itemId) ?? { ok: 0, failed: 0, succeededTargets: [] };
		updateItemAfterExecution(itemId, library.mediaType, summary);
	}
	db.prepare("update rename_plans set status = 'executed' where id = ?").run(planId);
	return failed === 0 ? 'succeeded' : ok > 0 ? 'partially_failed' : 'failed';
}

function summaryFor(summaries: Map<string, ItemExecutionSummary>, itemId: string) {
	let summary = summaries.get(itemId);
	if (!summary) {
		summary = { ok: 0, failed: 0, succeededTargets: [] };
		summaries.set(itemId, summary);
	}
	return summary;
}

function updateItemAfterExecution(itemId: string, mediaType: 'movie' | 'tv', summary: ItemExecutionSummary) {
	const db = getSqlite();
	const updatedAt = nowIso();
	const summaryJson = JSON.stringify({ ok: summary.ok, failed: summary.failed });
	if (summary.failed > 0) {
		db.prepare(
			`update library_items set last_execution_summary_json = @summary,
			 updated_at = @updatedAt where id = @id and status in ('identified', 'organized')`
		).run({ id: itemId, summary: summaryJson, updatedAt });
		return;
	}
	const compliant = summary.succeededTargets.filter((target) => isCompliantVideo(mediaType, target)).length;
	db.prepare(
		`update library_items set status = 'organized',
		 video_file_count = @videos,
		 compliant_file_count = @compliant,
		 non_compliant_file_count = @nonCompliant,
		 unknown_file_count = 0,
		 last_execution_summary_json = @summary,
		 updated_at = @updatedAt
		 where id = @id and status in ('identified', 'organized')`
	).run({
		id: itemId,
		videos: summary.succeededTargets.length,
		compliant,
		nonCompliant: summary.succeededTargets.length - compliant,
		summary: summaryJson,
		updatedAt
	});
}

function intermediateMovePath(from: string, to: string) {
	if (dirname(from) === dirname(to)) return null;
	if (basename(from) === basename(to)) return null;
	return joinRemote(dirname(to), basename(from));
}

async function discoverExistingSidecars(client: { exists(path: string): Promise<boolean> }, sourceFilePath: string) {
	const base = stripExt(sourceFilePath);
	const found: string[] = [];
	for (const extension of sidecarExtensions) {
		const candidate = `${base}${extension}`;
		if (await client.exists(candidate)) found.push(candidate);
	}
	return found;
}

async function writeMetadataOnce(
	client: { writeTextFile(path: string, content: string, overwrite?: boolean): Promise<void> },
	targetFilePath: string,
	mediaType: 'movie' | 'tv',
	done: Set<string>
) {
	const settings = getSettings();
	if (!settings.metadataEnabled) return;
	const targets = metadataTargets(targetFilePath, mediaType);
	if (done.has(targets.nfo)) return;
	done.add(targets.nfo);
	const nfo =
		mediaType === 'movie'
			? '<movie><title>Generated by Renarr</title></movie>\n'
			: '<tvshow><title>Generated by Renarr</title></tvshow>\n';
	await client.writeTextFile(targets.nfo, nfo, settings.overwriteMetadata);
}
