import { executeRenamePlan } from '$lib/server/services/executor';
import { log } from '$lib/server/services/logs';
import { scanLibraryItem, scanLibraryPath } from '$lib/server/services/scanner';
import { claimNextTask, failRunningTasksOnStartup, finishTask } from '$lib/server/services/tasks';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

failRunningTasksOnStartup();
log('info', 'TaskExecutor', 'Worker started');

while (true) {
	const task = claimNextTask();
	if (!task) {
		await delay(1000);
		continue;
	}
	try {
		log('info', 'TaskExecutor', 'Task started', { taskId: task.id, type: task.type });
		let state: 'succeeded' | 'partially_failed' | 'failed' = 'succeeded';
		let summary: unknown;
		if (task.type === 'scan_library_path') {
			summary = await scanLibraryPath(String(task.payload.libraryPathId), task.id);
		} else if (task.type === 'scan_library_item') {
			summary = await scanLibraryItem(String(task.payload.libraryItemId), task.id);
		} else if (task.type === 'execute_rename_plan') {
			const result = await executeRenamePlan(task.id, String(task.payload.planId));
			state = result.state;
			summary = result.summary;
		} else {
			throw new Error(`Unsupported task type: ${task.type}`);
		}
		finishTask(task.id, state, undefined, summary);
		log('info', 'TaskExecutor', 'Task finished', { taskId: task.id, state, summary });
	} catch (error) {
		finishTask(task.id, 'failed', String(error));
		log('error', 'TaskExecutor', 'Task failed', { taskId: task.id, error: String(error) });
	}
}
