import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import {
	executionRecords,
	libraryItems,
	renamePlanItems,
	renamePlans
} from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { basename, dirname, joinRemote, sidecarExtensions, stripExt } from './paths';
import { getClientForSource, getLibrary } from './sources';
import { log } from './logs';
import { metadataTargets } from './naming';
import { getSettings } from './settings';
import { isCompliantVideo } from './compliance';
import { updateTaskProgress } from './tasks';

type ItemExecutionSummary = {
	ok: number;
	failed: number;
	succeededTargets: string[];
};

type RenameTaskState = 'succeeded' | 'partially_failed' | 'failed';

export async function executeRenamePlan(taskId: string, planId: string) {
	const db = getDb();
	const plan = db.select().from(renamePlans).where(eq(renamePlans.id, planId)).get();
	if (!plan) throw new Error('Plan not found');
	const library = getLibrary(plan.libraryPathId);
	const client = getClientForSource(library.sourceId);
	const rows = db.select().from(renamePlanItems).where(eq(renamePlanItems.planId, planId)).all();
	let ok = 0;
	let failed = 0;
	let warningsCount = 0;
	const itemSummaries = new Map<string, ItemExecutionSummary>();
	const metadataDone = new Set<string>();
	log('info', 'RenameExecutor', 'Rename plan started', {
		taskId,
		planId,
		libraryPathId: plan.libraryPathId,
		summary: `Rename plan started: ${rows.length} files`
	});
	updateRenameProgress(taskId, 'moving', 'Preparing rename plan', 0, rows.length, {
		succeeded: ok,
		failed,
		warnings: warningsCount
	});
	for (const [index, row] of rows.entries()) {
		const itemId = row.libraryItemId;
		const originalSource = row.sourceFilePath;
		let source = originalSource;
		const target = row.targetFilePath;
		const warnings: Record<string, unknown>[] = [];
		updateRenameProgress(taskId, 'moving', `Moving ${source}`, index + 1, rows.length, {
			succeeded: ok,
			failed,
			warnings: warningsCount
		}, source);
		try {
			if (!(await client.exists(source))) {
				const intermediate = intermediateMovePath(source, target);
				if (intermediate && (await client.exists(intermediate))) {
					warnings.push({
						type: 'resumed_intermediate_move',
						originalSource: source,
						intermediate
					});
					source = intermediate;
				} else {
					throw new Error('Source file no longer exists');
				}
			}
			const overwrite = plan.mode === 'manual' && row.overwrite;
			if (!overwrite && (await client.exists(target))) throw new Error('Target file exists');
			await client.ensureDirectory(dirname(target));
			await client.moveFile(source, target, { overwrite });
			const sidecars = await discoverExistingSidecars(client, originalSource);
			for (const sidecar of sidecars) {
				try {
					if (await client.exists(sidecar)) {
						await client.moveFile(
							sidecar,
							joinRemote(dirname(target), sidecar.split('/').at(-1) || ''),
							{
								overwrite
							}
						);
					}
				} catch (error) {
					warningsCount += 1;
					warnings.push({ type: 'sidecar_move_failed', sidecar, error: String(error) });
					log('warn', 'RenameExecutor', 'Sidecar move failed', {
						taskId,
						planId,
						planItemId: row.id,
						libraryItemId: itemId,
						sidecar,
						error: String(error),
						summary: `${sidecar} sidecar move failed: ${String(error)}`
					});
				}
			}
			try {
				await writeMetadataOnce(client, target, library.mediaType, metadataDone);
			} catch (error) {
				warningsCount += 1;
				warnings.push({ type: 'metadata_write_failed', target, error: String(error) });
				log('warn', 'RenameExecutor', 'Metadata write failed', {
					taskId,
					planId,
					planItemId: row.id,
					libraryItemId: itemId,
					target,
					error: String(error),
					summary: `${target} metadata write failed: ${String(error)}`
				});
			}
			db.update(renamePlanItems)
				.set({ status: 'succeeded' })
				.where(eq(renamePlanItems.id, row.id))
				.run();
			db.insert(executionRecords)
				.values({
					id: newId(),
					taskId,
					planItemId: row.id,
					sourcePath: source,
					targetPath: target,
					status: 'succeeded',
					contextJson: JSON.stringify({ warnings, overwritten: overwrite }),
					createdAt: nowIso()
				})
				.run();
			ok += 1;
			log('info', 'RenameExecutor', 'File move succeeded', {
				taskId,
				planId,
				planItemId: row.id,
				libraryItemId: itemId,
				sourcePath: source,
				targetPath: target,
				summary: `${source} -> ${target}`
			});
			const summary = summaryFor(itemSummaries, itemId);
			summary.ok += 1;
			summary.succeededTargets.push(target);
		} catch (error) {
			db.update(renamePlanItems)
				.set({ status: 'failed' })
				.where(eq(renamePlanItems.id, row.id))
				.run();
			db.insert(executionRecords)
				.values({
					id: newId(),
					taskId,
					planItemId: row.id,
					sourcePath: source,
					targetPath: target,
					status: 'failed',
					error: String(error),
					contextJson: JSON.stringify({ error: String(error) }),
					createdAt: nowIso()
				})
				.run();
			failed += 1;
			log('error', 'RenameExecutor', 'File move failed', {
				taskId,
				planId,
				planItemId: row.id,
				libraryItemId: itemId,
				sourcePath: source,
				targetPath: target,
				error: String(error),
				summary: `${source} -> ${target}: ${String(error)}`
			});
			summaryFor(itemSummaries, itemId).failed += 1;
		}
		updateRenameProgress(taskId, 'moving', `Processed ${index + 1}/${rows.length}`, index + 1, rows.length, {
			succeeded: ok,
			failed,
			warnings: warningsCount
		});
	}
	const itemIds = [...new Set(rows.map((row) => row.libraryItemId))];
	for (const itemId of itemIds) {
		const summary = itemSummaries.get(itemId) ?? { ok: 0, failed: 0, succeededTargets: [] };
		updateItemAfterExecution(itemId, library.mediaType, summary);
	}
	db.update(renamePlans).set({ status: 'executed' }).where(eq(renamePlans.id, planId)).run();
	const state: RenameTaskState = failed === 0 ? 'succeeded' : ok > 0 ? 'partially_failed' : 'failed';
	const summary = { moved: ok, moveFailed: failed, warnings: warningsCount, total: rows.length };
	updateRenameProgress(taskId, 'completed', 'Rename plan finished', rows.length, rows.length, {
		succeeded: ok,
		failed,
		warnings: warningsCount
	});
	log(state === 'failed' ? 'error' : failed > 0 ? 'warn' : 'info', 'RenameExecutor', 'Rename plan finished', {
		taskId,
		planId,
		state,
		...summary,
		summary: `Rename plan finished: ${ok} moved, ${failed} failed, ${warningsCount} warnings`
	});
	return { state, summary };
}

function updateRenameProgress(
	taskId: string,
	phase: string,
	message: string,
	current: number,
	total: number,
	counts: Record<string, number>,
	currentTarget?: string
) {
	updateTaskProgress(taskId, {
		phase,
		message,
		current,
		total,
		...(currentTarget ? { currentTarget } : {}),
		counts
	});
}

function summaryFor(summaries: Map<string, ItemExecutionSummary>, itemId: string) {
	let summary = summaries.get(itemId);
	if (!summary) {
		summary = { ok: 0, failed: 0, succeededTargets: [] };
		summaries.set(itemId, summary);
	}
	return summary;
}

function updateItemAfterExecution(
	itemId: string,
	mediaType: 'movie' | 'tv',
	summary: ItemExecutionSummary
) {
	const db = getDb();
	const updatedAt = nowIso();
	const summaryJson = JSON.stringify({ ok: summary.ok, failed: summary.failed });
	if (summary.failed > 0) {
		db.update(libraryItems)
			.set({
				lastExecutionSummaryJson: summaryJson,
				updatedAt
			})
			.where(
				and(eq(libraryItems.id, itemId), inArray(libraryItems.status, ['identified', 'organized']))
			)
			.run();
		return;
	}
	const compliant = summary.succeededTargets.filter((target) =>
		isCompliantVideo(mediaType, target)
	).length;
	db.update(libraryItems)
		.set({
			status: 'organized',
			videoFileCount: summary.succeededTargets.length,
			compliantFileCount: compliant,
			nonCompliantFileCount: summary.succeededTargets.length - compliant,
			unknownFileCount: 0,
			lastExecutionSummaryJson: summaryJson,
			updatedAt
		})
		.where(
			and(eq(libraryItems.id, itemId), inArray(libraryItems.status, ['identified', 'organized']))
		)
		.run();
}

function intermediateMovePath(from: string, to: string) {
	if (dirname(from) === dirname(to)) return null;
	if (basename(from) === basename(to)) return null;
	return joinRemote(dirname(to), basename(from));
}

async function discoverExistingSidecars(
	client: { exists(path: string): Promise<boolean> },
	sourceFilePath: string
) {
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
