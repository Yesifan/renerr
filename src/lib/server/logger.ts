import pino, { type Bindings, type Logger, type LoggerOptions } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const redactPaths = [
	'apiKey',
	'tmdbApiKey',
	'tmdb.apiKey',
	'password',
	'passwd',
	'token',
	'accessToken',
	'refreshToken',
	'authorization',
	'Authorization',
	'cookie',
	'Cookie',
	'headers.authorization',
	'headers.Authorization',
	'headers.cookie',
	'headers.Cookie',
	'*.apiKey',
	'*.tmdbApiKey',
	'*.password',
	'*.token',
	'*.accessToken',
	'*.refreshToken',
	'*.authorization',
	'*.Authorization',
	'*.cookie',
	'*.Cookie'
];

const baseOptions: LoggerOptions = {
	level: process.env.LOG_LEVEL ?? (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
	base: undefined,
	redact: {
		paths: redactPaths,
		censor: '[Redacted]'
	},
	serializers: {
		err: pino.stdSerializers.err,
		error: pino.stdSerializers.err
	}
};

const rootLogger = pino(
	isProduction || isTest
		? baseOptions
		: {
				...baseOptions,
				transport: {
					target: 'pino-pretty',
					options: {
						colorize: true,
						ignore: 'pid,hostname',
						translateTime: 'SYS:standard'
					}
				}
			}
);

export function createNodeLogger(
	runtime: 'server' | 'worker' | 'script',
	bindings: Bindings = {}
): Logger {
	return rootLogger.child({ runtime, ...bindings });
}

export const logger = createNodeLogger('server');
