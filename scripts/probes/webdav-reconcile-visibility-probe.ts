import { createDecipheriv } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import posix from 'node:path/posix';
import process from 'node:process';
import Database from 'better-sqlite3';
import { createClient } from 'webdav';

type ProbeArgs = {
	planId?: string;
	rowId?: string;
	sourcePath?: string;
	targetPath?: string;
	limit: number;
	waits: number[];
	modes: ProbeMode[];
	json: boolean;
};

type ProbeMode = 'normal' | 'no-cache';

type ProbeRow = {
	planId: string;
	rowId: string;
	sourceFilePath: string;
	targetFilePath: string;
	sourceName: string;
	sourceUrl: string;
	username: string;
	credentialEncrypted: string;
};

type ModeSnapshot = {
	mode: ProbeMode;
	afterMs: number;
	rows: number;
	sourceExists: number;
	targetExists: number;
	sourceListed: number;
	targetListed: number;
	successByExists: number;
	successByListing: number;
	existsTargetMissingButListed: string[];
	existsSourcePresentButUnlisted: string[];
	listErrors: Record<string, string>;
	existsErrors: Record<string, string>;
};

const defaultWaits = [0, 5000, 15000, 30000, 60000];
const noCacheHeaders = {
	'Cache-Control': 'no-cache, no-store, must-revalidate',
	Pragma: 'no-cache',
	Expires: '0'
};

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const rows = findProbeRows(args);
	if (rows.length === 0) throw new Error('No rename plan item found.');
	const source = rows[0];
	if (!source) throw new Error('No rename plan item found.');

	printPlan(source, rows, args);
	const password = decryptCredential(source.credentialEncrypted);
	const clients = new Map(
		args.modes.map((mode) => [
			mode,
			createClient(source.sourceUrl, {
				username: source.username,
				password,
				...(mode === 'no-cache' ? { headers: noCacheHeaders } : {})
			})
		])
	);

	const snapshots: ModeSnapshot[] = [];
	let elapsed = 0;
	for (const waitMs of args.waits) {
		if (waitMs > elapsed) {
			await sleep(waitMs - elapsed);
			elapsed = waitMs;
		}
		for (const mode of args.modes) {
			const client = clients.get(mode);
			if (!client) continue;
			const snapshot = await probeMode(mode, client, rows, waitMs);
			snapshots.push(snapshot);
			if (!args.json) printSnapshot(snapshot);
		}
	}

	if (args.json) {
		console.log(
			JSON.stringify(
				{
					planId: source.planId,
					rows: rows.map((row) => ({
						rowId: row.rowId,
						sourceFilePath: row.sourceFilePath,
						targetFilePath: row.targetFilePath
					})),
					snapshots
				},
				null,
				2
			)
		);
	}
}

async function probeMode(
	mode: ProbeMode,
	client: ReturnType<typeof createClient>,
	rows: ProbeRow[],
	afterMs: number
): Promise<ModeSnapshot> {
	const directoryEntries = await listRelevantDirectories(client, rows);
	const existsResults = await existsRelevantPaths(client, rows);
	const listErrors: Record<string, string> = {};
	const existsErrors: Record<string, string> = {};
	for (const [directory, value] of directoryEntries.entries()) {
		if (typeof value === 'string') listErrors[directory] = value;
	}
	for (const [remotePath, value] of existsResults.entries()) {
		if (typeof value === 'string') existsErrors[remotePath] = value;
	}

	let sourceExists = 0;
	let targetExists = 0;
	let sourceListed = 0;
	let targetListed = 0;
	let successByExists = 0;
	let successByListing = 0;
	const existsTargetMissingButListed: string[] = [];
	const existsSourcePresentButUnlisted: string[] = [];

	for (const row of rows) {
		const sourceExistsValue = existsResults.get(row.sourceFilePath) === true;
		const targetExistsValue = existsResults.get(row.targetFilePath) === true;
		const sourceListedValue = directoryHas(directoryEntries, row.sourceFilePath);
		const targetListedValue = directoryHas(directoryEntries, row.targetFilePath);

		if (sourceExistsValue) sourceExists += 1;
		if (targetExistsValue) targetExists += 1;
		if (sourceListedValue) sourceListed += 1;
		if (targetListedValue) targetListed += 1;
		if (!sourceExistsValue && targetExistsValue) successByExists += 1;
		if (!sourceListedValue && targetListedValue) successByListing += 1;
		if (!targetExistsValue && targetListedValue) {
			existsTargetMissingButListed.push(row.targetFilePath);
		}
		if (sourceExistsValue && !sourceListedValue) {
			existsSourcePresentButUnlisted.push(row.sourceFilePath);
		}
	}

	return {
		mode,
		afterMs,
		rows: rows.length,
		sourceExists,
		targetExists,
		sourceListed,
		targetListed,
		successByExists,
		successByListing,
		existsTargetMissingButListed,
		existsSourcePresentButUnlisted,
		listErrors,
		existsErrors
	};
}

async function listRelevantDirectories(client: ReturnType<typeof createClient>, rows: ProbeRow[]) {
	const directories = new Set<string>();
	for (const row of rows) {
		directories.add(dirname(row.sourceFilePath));
		directories.add(dirname(row.targetFilePath));
	}
	const results = new Map<string, Set<string> | string>();
	for (const directory of directories) {
		try {
			const result = await client.getDirectoryContents(directory);
			const entries = Array.isArray(result) ? result : result.data;
			results.set(directory, new Set(entries.map((entry) => entry.basename)));
		} catch (error) {
			results.set(directory, stringifyError(error));
		}
	}
	return results;
}

async function existsRelevantPaths(client: ReturnType<typeof createClient>, rows: ProbeRow[]) {
	const paths = new Set<string>();
	for (const row of rows) {
		paths.add(row.sourceFilePath);
		paths.add(row.targetFilePath);
	}
	const results = new Map<string, boolean | string>();
	for (const remotePath of paths) {
		try {
			results.set(remotePath, await client.exists(remotePath));
		} catch (error) {
			results.set(remotePath, stringifyError(error));
		}
	}
	return results;
}

function directoryHas(directoryEntries: Map<string, Set<string> | string>, remotePath: string) {
	const entries = directoryEntries.get(dirname(remotePath));
	return entries instanceof Set && entries.has(basename(remotePath));
}

function findProbeRows(args: ProbeArgs): ProbeRow[] {
	const db = new Database(getDatabasePath(), { readonly: true, fileMustExist: true });
	try {
		const limit = args.sourcePath || args.targetPath ? 1 : args.limit;
		return db
			.prepare(
				`select
					rp.id as planId,
					rpi.id as rowId,
					coalesce(?, rpi.source_file_path) as sourceFilePath,
					coalesce(?, rpi.target_file_path) as targetFilePath,
					ws.name as sourceName,
					ws.url as sourceUrl,
					ws.username as username,
					ws.credential_encrypted as credentialEncrypted
				from rename_plan_items rpi
				inner join rename_plans rp on rp.id = rpi.plan_id
				inner join library_paths lp on lp.id = rp.library_path_id
				inner join webdav_sources ws on ws.id = lp.source_id
				where (? is null or rp.id = ?)
				  and (? is null or rpi.id = ?)
				order by rpi.id asc
				limit ?`
			)
			.all(
				args.sourcePath ?? null,
				args.targetPath ?? null,
				args.planId ?? null,
				args.planId ?? null,
				args.rowId ?? null,
				args.rowId ?? null,
				limit
			) as ProbeRow[];
	} finally {
		db.close();
	}
}

function printPlan(source: ProbeRow, rows: ProbeRow[], args: ProbeArgs) {
	console.log('Renarr WebDAV reconcile visibility probe');
	console.log('');
	console.log(`DB: ${getDatabasePath()}`);
	console.log(`Source: ${source.sourceName} (${redactUrl(source.sourceUrl)})`);
	console.log(`Plan: ${source.planId}`);
	console.log(`Rows: ${rows.length}`);
	console.log(`Modes: ${args.modes.join(', ')}`);
	console.log(`Waits: ${args.waits.join(', ')}ms`);
	console.log(`Sample source: ${source.sourceFilePath}`);
	console.log(`Sample target: ${source.targetFilePath}`);
	console.log('');
}

function printSnapshot(snapshot: ModeSnapshot) {
	console.log(
		[
			`[${snapshot.mode}] ${snapshot.afterMs}ms`,
			`rows=${snapshot.rows}`,
			`exists source/target=${snapshot.sourceExists}/${snapshot.targetExists}`,
			`listed source/target=${snapshot.sourceListed}/${snapshot.targetListed}`,
			`success exists/listing=${snapshot.successByExists}/${snapshot.successByListing}`,
			`target-listed-but-exists-missing=${snapshot.existsTargetMissingButListed.length}`
		].join(' | ')
	);
	if (Object.keys(snapshot.listErrors).length > 0) {
		console.log(`  list errors: ${JSON.stringify(snapshot.listErrors)}`);
	}
	if (Object.keys(snapshot.existsErrors).length > 0) {
		console.log(`  exists errors: ${JSON.stringify(snapshot.existsErrors)}`);
	}
	if (snapshot.existsTargetMissingButListed.length > 0) {
		console.log('  target exists false but target directory lists it:');
		for (const target of snapshot.existsTargetMissingButListed.slice(0, 10)) {
			console.log(`    ${target}`);
		}
		if (snapshot.existsTargetMissingButListed.length > 10) console.log('    ...');
	}
}

function parseArgs(argv: string[]): ProbeArgs {
	const args: ProbeArgs = {
		limit: 100,
		waits: defaultWaits,
		modes: ['normal', 'no-cache'],
		json: false
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--plan') args.planId = readValue(argv, ++index, arg);
		else if (arg === '--row') args.rowId = readValue(argv, ++index, arg);
		else if (arg === '--source-path') args.sourcePath = readValue(argv, ++index, arg);
		else if (arg === '--target-path') args.targetPath = readValue(argv, ++index, arg);
		else if (arg === '--limit') args.limit = parsePositiveInt(readValue(argv, ++index, arg), arg);
		else if (arg === '--waits') args.waits = parseWaits(readValue(argv, ++index, arg));
		else if (arg === '--mode') args.modes = parseModes(readValue(argv, ++index, arg));
		else if (arg === '--json') args.json = true;
		else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return args;
}

function printHelp() {
	console.log(`Usage:
  pnpm exec tsx scripts/probes/webdav-reconcile-visibility-probe.ts --plan <id>

Options:
  --plan <id>       Probe rows from a specific rename plan.
  --row <id>        Probe a specific rename plan item.
  --source-path <p> Override source path while still using the selected plan/source credentials.
  --target-path <p> Override target path while still using the selected plan/source credentials.
  --limit <n>       Max rows to probe. Default: 100
  --waits <ms>      Comma wait snapshots. Default: 0,5000,15000,30000,60000
  --mode <modes>    normal,no-cache,both. Default: both
  --json            Print JSON only.

This probe is read-only. It does not create, move, overwrite, or delete remote files.
`);
}

function parseWaits(value: string) {
	const parsed = value
		.split(',')
		.map((part) => Number(part.trim()))
		.filter((part) => Number.isFinite(part) && part >= 0)
		.sort((a, b) => a - b);
	if (!parsed.includes(0)) parsed.unshift(0);
	if (parsed.length === 0) throw new Error('--waits must include at least one millisecond value');
	return parsed;
}

function parseModes(value: string): ProbeMode[] {
	const normalized = value.trim();
	if (normalized === 'both') return ['normal', 'no-cache'];
	const modes = normalized
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (modes.length === 0) throw new Error('--mode cannot be empty');
	for (const mode of modes) {
		if (mode !== 'normal' && mode !== 'no-cache') {
			throw new Error(`Invalid mode: ${mode}`);
		}
	}
	return modes as ProbeMode[];
}

function readValue(argv: string[], index: number, flag: string) {
	const value = argv[index];
	if (!value) throw new Error(`Missing value for ${flag}`);
	return value;
}

function parsePositiveInt(value: string, flag: string) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0)
		throw new Error(`${flag} must be a positive integer`);
	return parsed;
}

function getDatabasePath() {
	const dataDir =
		process.env.RENERR_DATA_DIR ||
		process.env.RENARR_DATA_DIR ||
		path.join(process.cwd(), '.renarr-data');
	const databasePath = path.join(dataDir, 'renarr.db');
	if (!existsSync(databasePath)) {
		mkdirSync(dataDir, { recursive: true });
	}
	return databasePath;
}

function decryptCredential(value: string) {
	const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64'));
	const decipher = createDecipheriv('aes-256-gcm', getSecretKey(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function getSecretKey() {
	const raw = process.env.RENERR_SECRET_KEY || process.env.RENARR_SECRET_KEY;
	if (raw) return Buffer.from(raw, 'base64');
	return Buffer.from('dev-only-renarr-secret-key-32-bytes!!').subarray(0, 32);
}

function redactUrl(value: string) {
	try {
		const url = new URL(value);
		if (url.username || url.password) {
			url.username = url.username ? '***' : '';
			url.password = url.password ? '***' : '';
		}
		return url.toString();
	} catch {
		return value.replace(/\/\/([^/@:]+)(?::[^/@]*)?@/, '//***:***@');
	}
}

function dirname(value: string) {
	return posix.dirname(value);
}

function basename(value: string) {
	return posix.basename(value);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyError(error: unknown) {
	return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
