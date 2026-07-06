import type { Bindings, Logger } from 'pino';
import { createNodeLogger } from '$lib/server/logger';
import { appendTaskDetailLine, type TaskDetailLineLevel } from './task-detail-lines';

export class TaskRecorder {
	readonly #logger: Logger;
	readonly #runtime: 'server' | 'worker';

	constructor(
		readonly taskId: string,
		bindings: Bindings = {},
		runtime: 'server' | 'worker' = 'server'
	) {
		this.#runtime = runtime;
		this.#logger = createNodeLogger(runtime, { taskId, ...bindings });
	}

	info(message: string, context: Record<string, unknown> = {}) {
		this.#write('info', message, context);
	}

	warn(message: string, context: Record<string, unknown> = {}) {
		this.#write('warn', message, context);
	}

	error(message: string, context: Record<string, unknown> = {}) {
		this.#write('error', message, context);
	}

	child(bindings: Bindings) {
		return new TaskRecorder(this.taskId, bindings, this.#runtime);
	}

	#write(level: TaskDetailLineLevel, message: string, context: Record<string, unknown>) {
		this.#logger[level]({ ...context }, message);
		appendTaskDetailLine({ taskId: this.taskId, level, message });
	}
}

export function createTaskRecorder(
	taskId: string,
	bindings: Bindings = {},
	runtime: 'server' | 'worker' = 'server'
) {
	return new TaskRecorder(taskId, bindings, runtime);
}
