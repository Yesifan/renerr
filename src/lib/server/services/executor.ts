import { eq } from 'drizzle-orm';
import {
	FileMoveError,
	type MoveResult,
	type MoveStep
} from '$lib/server/integrations/file-client';
import { getDb } from '$lib/server/db';
import { executionRecords, renamePlanItems, renamePlans } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { nowIso } from '$lib/server/time';
import { dirname, joinRemote, sidecarExtensions, stripExt } from './paths';
import { getClientForSource, getLibrary } from './sources';
import { log } from './logs';
import { metadataTargets } from './naming';
import { getSettings } from './settings';
import { enqueueTask, updateTaskProgress } from './tasks';

type RenameTaskState = 'succeeded' | 'partially_failed' | 'failed';
type RenamePlanRow = typeof renamePlanItems.$inferSelect;
type RenameClient = {
	exists(path: string): Promise<boolean>;
	ensureDirectory(path: string): Promise<void>;
	moveFile(
		from: string,
		to: string,
		options?: { overwrite?: boolean }
	): Promise<{ ok: true; steps?: MoveStep[]; warnings?: Record<string, unknown>[] }>;
	writeTextFile(path: string, content: string, overwrite?: boolean): Promise<void>;
};
type ExecutionCounters = {
	ok: number;
	failed: number;
	warnings: number;
};
type RowWork = {
	row: RenamePlanRow;
	itemId: string;
	originalSource: string;
	target: string;
	overwrite: boolean;
	warnings: Record<string, unknown>[];
	moveSteps: MoveStep[];
	status?: 'succeeded' | 'failed' | 'conflict';
	error?: string;
	failureStage?: string;
	intermediatePath?: string;
};

export async function executeRenamePlan(taskId: string, planId: string) {
	const db = getDb();
	const plan = db.select().from(renamePlans).where(eq(renamePlans.id, planId)).get();
	if (!plan) throw new Error('Plan not found');
	if (plan.status !== 'confirmed' && plan.status !== 'executing') {
		throw new Error(`Rename plan is not executable: ${plan.status}`);
	}
	db.update(renamePlans).set({ status: 'executing' }).where(eq(renamePlans.id, planId)).run();

	const library = getLibrary(plan.libraryPathId);
	const client = getClientForSource(library.sourceId);
	const rows = db.select().from(renamePlanItems).where(eq(renamePlanItems.planId, planId)).all();
	const counters: ExecutionCounters = { ok: 0, failed: 0, warnings: 0 };
	const metadataDone = new Set<string>();
	const works: RowWork[] = rows.map((row) => ({
		row,
		itemId: row.libraryItemId,
		originalSource: row.sourceFilePath,
		target: row.targetFilePath,
		overwrite: plan.mode === 'manual' && row.overwrite,
		warnings: [],
		moveSteps: []
	}));

	log('info', 'RenameExecutor', 'Rename plan started', {
		taskId,
		planId,
		libraryPathId: plan.libraryPathId,
		summary: `Rename plan started: ${rows.length} files`
	});
	updateRenameProgress(taskId, 'moving', 'Preparing rename plan', 0, rows.length, {
		succeeded: counters.ok,
		failed: counters.failed,
		warnings: counters.warnings
	});

	for (const [index, work] of works.entries()) {
		updateRenameProgress(
			taskId,
			'moving',
			`Moving ${index + 1}/${rows.length}`,
			index + 1,
			rows.length,
			{
				succeeded: counters.ok,
				failed: counters.failed,
				warnings: counters.warnings
			},
			work.originalSource
		);
		await executeRow(client, {
			taskId,
			planId,
			libraryMediaType: library.mediaType,
			metadataDone,
			work,
			counters
		});
		persistRowResult(taskId, planId, work);
		if (work.status === 'succeeded') counters.ok += 1;
		else counters.failed += 1;
		updateRenameProgress(
			taskId,
			'moving',
			`Processed ${index + 1}/${rows.length}`,
			index + 1,
			rows.length,
			{
				succeeded: counters.ok,
				failed: counters.failed,
				warnings: counters.warnings
			},
			work.target
		);
	}

	db.update(renamePlans).set({ status: 'executed' }).where(eq(renamePlans.id, planId)).run();
	const scanSummary = enqueueAffectedScans(plan.libraryPathId, works);
	const state: RenameTaskState =
		counters.failed === 0 ? 'succeeded' : counters.ok > 0 ? 'partially_failed' : 'failed';
	const summary = {
		moved: counters.ok,
		moveFailed: counters.failed,
		warnings: counters.warnings,
		total: rows.length,
		scans: scanSummary
	};
	updateRenameProgress(taskId, 'completed', 'Rename plan finished', rows.length, rows.length, {
		succeeded: counters.ok,
		failed: counters.failed,
		warnings: counters.warnings
	});
	log(
		state === 'failed' ? 'error' : counters.failed > 0 ? 'warn' : 'info',
		'RenameExecutor',
		'Rename plan finished',
		{
			taskId,
			planId,
			state,
			...summary,
			summary: `Rename plan finished: ${counters.ok} moved, ${counters.failed} failed, ${counters.warnings} warnings`
		}
	);
	return { state, summary };
}

async function executeRow(
	client: RenameClient,
	input: {
		taskId: string;
		planId: string;
		libraryMediaType: 'movie' | 'tv';
		metadataDone: Set<string>;
		work: RowWork;
		counters: ExecutionCounters;
	}
) {
	const { work } = input;
	try {
		if (!work.overwrite && (await client.exists(work.target))) {
			work.status = 'conflict';
			work.error = 'Target file exists';
			return;
		}
		await client.ensureDirectory(dirname(work.target));
		const moveResult = await client.moveFile(work.originalSource, work.target, {
			overwrite: work.overwrite
		});
		applyMoveResult(work, moveResult, input.counters);
		await runPostMoveActions(client, input);
		work.status = 'succeeded';
	} catch (error) {
		work.status = 'failed';
		work.error = String(error);
		if (error instanceof FileMoveError) {
			work.failureStage = error.stage;
			work.intermediatePath = error.intermediate;
			work.error = error.message;
		}
	}
}

function applyMoveResult(work: RowWork, result: MoveResult, counters: ExecutionCounters) {
	if (result.steps?.length) work.moveSteps.push(...result.steps);
	if (result.warnings?.length) {
		work.warnings.push(...result.warnings);
		counters.warnings += result.warnings.length;
	}
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

async function runPostMoveActions(
	client: RenameClient,
	input: {
		taskId: string;
		planId: string;
		libraryMediaType: 'movie' | 'tv';
		metadataDone: Set<string>;
		work: RowWork;
		counters: ExecutionCounters;
	}
) {
	const { taskId, planId, work } = input;
	const sidecars = await discoverExistingSidecars(client, work.originalSource);
	for (const sidecar of sidecars) {
		try {
			if (await client.exists(sidecar)) {
				const sidecarResult = await client.moveFile(
					sidecar,
					joinRemote(dirname(work.target), sidecar.split('/').at(-1) || ''),
					{ overwrite: work.overwrite }
				);
				if (sidecarResult.warnings?.length) {
					work.warnings.push(...sidecarResult.warnings);
					input.counters.warnings += sidecarResult.warnings.length;
				}
			}
		} catch (error) {
			input.counters.warnings += 1;
			work.warnings.push({
				type: 'sidecar_move_failed',
				sidecar,
				stage: error instanceof FileMoveError ? error.stage : undefined,
				intermediatePath: error instanceof FileMoveError ? error.intermediate : undefined,
				error: String(error)
			});
			log('warn', 'RenameExecutor', 'Sidecar move failed', {
				taskId,
				planId,
				planItemId: work.row.id,
				libraryItemId: work.itemId,
				sidecar,
				error: String(error),
				summary: `${sidecar} sidecar move failed: ${String(error)}`
			});
		}
	}
	try {
		await writeMetadataOnce(client, work.target, input.libraryMediaType, input.metadataDone);
	} catch (error) {
		input.counters.warnings += 1;
		work.warnings.push({
			type: 'metadata_write_failed',
			target: work.target,
			error: String(error)
		});
		log('warn', 'RenameExecutor', 'Metadata write failed', {
			taskId,
			planId,
			planItemId: work.row.id,
			libraryItemId: work.itemId,
			target: work.target,
			error: String(error),
			summary: `${work.target} metadata write failed: ${String(error)}`
		});
	}
}

function persistRowResult(taskId: string, planId: string, work: RowWork) {
	const db = getDb();
	const status = work.status ?? 'failed';
	db.update(renamePlanItems).set({ status }).where(eq(renamePlanItems.id, work.row.id)).run();
	db.insert(executionRecords)
		.values({
			id: newId(),
			taskId,
			planItemId: work.row.id,
			sourcePath: work.originalSource,
			targetPath: work.target,
			status,
			error: work.error,
			contextJson: JSON.stringify({
				originalSource: work.originalSource,
				finalTarget: work.target,
				moveSteps: work.moveSteps,
				failureStage: work.failureStage,
				intermediatePath: work.intermediatePath,
				warnings: work.warnings,
				overwritten: work.overwrite,
				error: work.error
			}),
			createdAt: nowIso()
		})
		.run();
	log(
		status === 'succeeded' ? 'info' : 'error',
		'RenameExecutor',
		status === 'succeeded' ? 'File move succeeded' : 'File move failed',
		{
			taskId,
			planId,
			planItemId: work.row.id,
			libraryItemId: work.itemId,
			sourcePath: work.originalSource,
			targetPath: work.target,
			failureStage: work.failureStage,
			intermediatePath: work.intermediatePath,
			error: work.error,
			summary:
				status === 'succeeded'
					? `${work.originalSource} -> ${work.target}`
					: `${work.originalSource} -> ${work.target}: ${work.error}`
		}
	);
}

function enqueueAffectedScans(libraryPathId: string, works: RowWork[]) {
	const sourceDirectories = [...new Set(works.map((work) => dirname(work.originalSource)))];
	const targetDirectories = [...new Set(works.map((work) => dirname(work.target)))];
	const affectedDirectories = [...new Set([...sourceDirectories, ...targetDirectories])];
	const scanTargets: Record<string, unknown>[] = [];
	try {
		const task = enqueueTask('scan_library_path', { libraryPathId });
		scanTargets.push({
			type: 'scan_library_path',
			libraryPathId,
			taskId: task.id,
			state: task.state,
			status: 'queued_or_reused'
		});
	} catch (error) {
		scanTargets.push({
			type: 'scan_library_path',
			libraryPathId,
			status: 'failed_to_enqueue',
			error: String(error)
		});
	}
	return {
		sourceDirectories,
		targetDirectories,
		affectedDirectories,
		targets: scanTargets
	};
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
