import { executeRenamePlan } from '$lib/server/services/executor';
import { runCreateRenamePlanForItemTask } from '$lib/server/services/planner';
import { scanLibraryItem, scanLibraryPath } from '$lib/server/services/scanner';
import { claimNextTask, failRunningTasksOnStartup, finishTask } from '$lib/server/services/tasks';
import { workerLogger } from '$lib/server/logger-worker';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

failRunningTasksOnStartup();
workerLogger.info({ component: 'TaskExecutor' }, 'Worker started');

while (true) {
	const task = claimNextTask();
	if (!task) {
		await delay(1000);
		continue;
	}
	try {
		workerLogger.info(
			{ component: 'TaskExecutor', taskId: task.id, type: task.type },
			'Task started'
		);
		let state: 'succeeded' | 'partially_failed' | 'failed' = 'succeeded';
		let summary: unknown;
		if (task.type === 'scan_library_path') {
			summary = await scanLibraryPath(String(task.payload.libraryPathId), task.id);
		} else if (task.type === 'scan_library_item') {
			summary = await scanLibraryItem(String(task.payload.libraryItemId), task.id);
		} else if (task.type === 'create_rename_plan_for_item') {
			summary = await runCreateRenamePlanForItemTask(task.id, String(task.payload.libraryItemId));
		} else if (task.type === 'execute_rename_plan') {
			const result = await executeRenamePlan(task.id, String(task.payload.planId));
			state = result.state;
			summary = result.summary;
		} else {
			throw new Error(`Unsupported task type: ${task.type}`);
		}
		finishTask(task.id, state, undefined, summary);
		workerLogger.info(
			{ component: 'TaskExecutor', taskId: task.id, state, summary },
			'Task finished'
		);
	} catch (error) {
		finishTask(task.id, 'failed', String(error));
		workerLogger.error({ component: 'TaskExecutor', taskId: task.id, err: error }, 'Task failed');
	}
}
