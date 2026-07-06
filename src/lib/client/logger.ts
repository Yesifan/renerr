import { dev } from '$app/environment';
import pino from 'pino';
import type { Bindings, Logger } from 'pino';

const rootLogger = pino({
	level: dev ? 'debug' : 'silent',
	browser: {
		asObject: true,
		disabled: !dev
	}
});

export function createClientLogger(bindings: Bindings = {}): Logger {
	return rootLogger.child({ runtime: 'client', ...bindings });
}

export const logger = createClientLogger();
