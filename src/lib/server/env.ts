import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

setupProxyDispatcher();

function setupProxyDispatcher() {
	const proxy =
		process.env.HTTPS_PROXY ||
		process.env.https_proxy ||
		process.env.HTTP_PROXY ||
		process.env.http_proxy ||
		process.env.ALL_PROXY ||
		process.env.all_proxy;
	if (proxy) {
		// Node 内置 fetch 不读 HTTP_PROXY 环境变量，需手动设置全局 dispatcher。
		setGlobalDispatcher(new ProxyAgent(proxy));
	}
}

export function getDataDir() {
	const dir =
		process.env.RENERR_DATA_DIR ||
		process.env.RENARR_DATA_DIR ||
		join(process.cwd(), '.renarr-data');
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function getDatabasePath() {
	return join(getDataDir(), 'renarr.db');
}

export function getSecretKey() {
	const raw = process.env.RENERR_SECRET_KEY || process.env.RENARR_SECRET_KEY;
	if (raw) return Buffer.from(raw, 'base64');
	if (process.env.NODE_ENV === 'production') {
		throw new Error('RENERR_SECRET_KEY must be set to a 32-byte base64 key in production');
	}
	return Buffer.from('dev-only-renarr-secret-key-32-bytes!!').subarray(0, 32);
}
