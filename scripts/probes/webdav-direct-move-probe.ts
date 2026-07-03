import { createDecipheriv } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import posix from 'node:path/posix';
import process from 'node:process';
import Database from 'better-sqlite3';
import { createClient } from 'webdav';

type ProbeArgs = {
	run: boolean;
	keep: boolean;
	planId?: string;
	rowId?: string;
	createTargetDir: boolean;
	hidden: boolean;
	extension: string;
	only: Set<string>;
	waits: number[];
};

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

type ProbeResult = {
	name: string;
	from: string;
	to: string;
	moveOk: boolean;
	moveError?: string;
	snapshots: Snapshot[];
	cleanupErrors: string[];
};

type Snapshot = {
	label: string;
	afterMs: number;
	sourceExists: boolean;
	targetExists: boolean;
	sourceListed: boolean;
	targetListed: boolean;
	sourceListError?: string;
	targetListError?: string;
};

const defaultWaits = [0, 5000, 10000, 30000];
const probeStamp = new Date()
	.toISOString()
	.replace(/[-:.TZ]/g, '')
	.slice(0, 14);

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const row = findProbeRow(args);
	const sourceDir = dirname(row.sourceFilePath);
	const targetDir = dirname(row.targetFilePath);
	const prefix = `${args.hidden ? '.' : ''}renarr-probe-${probeStamp}`;
	const directTargetName = `${prefix}-direct-renamed${args.extension}`;
	const sameName = `${prefix}-same-name${args.extension}`;
	const sameDirName = `${prefix}-same-dir${args.extension}`;

	printPlan(row, sourceDir, targetDir, args);
	if (!args.run) {
		console.log('\nDry run only. Re-run with --run to create and move probe files.');
		return;
	}

	const client = createClient(row.sourceUrl, {
		username: row.username,
		password: decryptCredential(row.credentialEncrypted)
	});

	if (!(await client.exists(sourceDir))) {
		throw new Error(`Source directory does not exist: ${sourceDir}`);
	}
	if (!(await client.exists(targetDir))) {
		if (!args.createTargetDir) {
			throw new Error(
				`Target directory does not exist: ${targetDir}\n` +
					'Use a plan row whose target directory already exists, or pass --create-target-dir.'
			);
		}
		await client.createDirectory(targetDir, { recursive: true });
	}

	const results: ProbeResult[] = [];
	if (shouldRun(args, 'same_dir_rename')) {
		results.push(
			await runMoveProbe(client, {
				name: 'same_dir_rename',
				from: joinRemote(sourceDir, sameDirName),
				to: joinRemote(sourceDir, `${prefix}-same-dir-renamed${args.extension}`),
				keep: args.keep,
				waits: args.waits
			})
		);
	}

	if (sourceDir === targetDir) {
		console.log('\nSkipping cross-directory probes because sourceDir equals targetDir.');
	} else {
		if (shouldRun(args, 'cross_dir_same_basename')) {
			results.push(
				await runMoveProbe(client, {
					name: 'cross_dir_same_basename',
					from: joinRemote(sourceDir, sameName),
					to: joinRemote(targetDir, sameName),
					keep: args.keep,
					waits: args.waits
				})
			);
		}
		if (shouldRun(args, 'cross_dir_direct_rename')) {
			results.push(
				await runMoveProbe(client, {
					name: 'cross_dir_direct_rename',
					from: joinRemote(sourceDir, `${prefix}-direct-source${args.extension}`),
					to: joinRemote(targetDir, directTargetName),
					keep: args.keep,
					waits: args.waits
				})
			);
		}
	}

	console.log('\nProbe results:');
	console.log(
		JSON.stringify({ sourceDir, targetDir, results, recommendation: recommend(results) }, null, 2)
	);
}

async function runMoveProbe(
	client: ReturnType<typeof createClient>,
	input: { name: string; from: string; to: string; keep: boolean; waits: number[] }
): Promise<ProbeResult> {
	const cleanupErrors: string[] = [];
	await safeDelete(client, input.from, cleanupErrors);
	await safeDelete(client, input.to, cleanupErrors);
	await client.putFileContents(input.from, `renarr webdav move probe ${input.name}\n`, {
		overwrite: false
	});

	let moveOk = false;
	let moveError: string | undefined;
	try {
		await client.moveFile(input.from, input.to, { overwrite: false });
		moveOk = true;
	} catch (error) {
		moveError = stringifyError(error);
	}

	const snapshots: Snapshot[] = [];
	let elapsed = 0;
	for (const waitMs of input.waits) {
		if (waitMs > elapsed) {
			await sleep(waitMs - elapsed);
			elapsed = waitMs;
		}
		snapshots.push({
			label: `${waitMs}ms`,
			afterMs: waitMs,
			sourceExists: await client.exists(input.from),
			targetExists: await client.exists(input.to),
			...(await listPresence(client, input.from, input.to))
		});
	}

	if (!input.keep) {
		await safeDelete(client, input.from, cleanupErrors);
		await safeDelete(client, input.to, cleanupErrors);
	}

	return {
		name: input.name,
		from: input.from,
		to: input.to,
		moveOk,
		...(moveError ? { moveError } : {}),
		snapshots,
		cleanupErrors
	};
}

function findProbeRow(args: ProbeArgs): ProbeRow {
	const dbPath = getDatabasePath();
	const db = new Database(dbPath, { readonly: true, fileMustExist: true });
	try {
		const rows = db
			.prepare(
				`select
					rp.id as planId,
					rpi.id as rowId,
					rpi.source_file_path as sourceFilePath,
					rpi.target_file_path as targetFilePath,
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
				order by rp.created_at desc, rpi.id asc
				limit 100`
			)
			.all(
				args.planId ?? null,
				args.planId ?? null,
				args.rowId ?? null,
				args.rowId ?? null
			) as ProbeRow[];
		const crossDirRename = rows.find(
			(row) =>
				dirname(row.sourceFilePath) !== dirname(row.targetFilePath) &&
				basename(row.sourceFilePath) !== basename(row.targetFilePath)
		);
		const selected = crossDirRename ?? rows[0];
		if (!selected) {
			throw new Error('No rename plan item found. Pass --plan <id> or create a rename plan first.');
		}
		return selected;
	} finally {
		db.close();
	}
}

function printPlan(row: ProbeRow, sourceDir: string, targetDir: string, args: ProbeArgs) {
	console.log('Renarr WebDAV direct MOVE probe');
	console.log('');
	console.log(`DB: ${getDatabasePath()}`);
	console.log(`Source: ${row.sourceName} (${redactUrl(row.sourceUrl)})`);
	console.log(`Plan: ${row.planId}`);
	console.log(`Row: ${row.rowId}`);
	console.log(`Source file sample: ${row.sourceFilePath}`);
	console.log(`Target file sample: ${row.targetFilePath}`);
	console.log(`Probe source dir: ${sourceDir}`);
	console.log(`Probe target dir: ${targetDir}`);
	console.log(`Mode: ${args.run ? 'run' : 'dry-run'}`);
	console.log(`Keep probe files: ${args.keep ? 'yes' : 'no'}`);
}

function recommend(results: ProbeResult[]) {
	const direct = results.find((result) => result.name === 'cross_dir_direct_rename');
	if (!direct) return 'cross_directory_probe_skipped';
	if (!direct.moveOk) return 'direct_cross_dir_rename_failed';
	const firstVisible = direct.snapshots.find((snapshot) => snapshot.targetExists);
	if (!firstVisible) return 'direct_cross_dir_rename_succeeded_but_target_never_visible';
	if (firstVisible.afterMs > 0) {
		return `direct_cross_dir_rename_supported_with_visibility_delay_${firstVisible.afterMs}ms`;
	}
	return 'direct_cross_dir_rename_supported_immediately';
}

function parseArgs(argv: string[]): ProbeArgs {
	const args: ProbeArgs = {
		run: false,
		keep: false,
		createTargetDir: false,
		hidden: false,
		extension: '.txt',
		only: new Set(),
		waits: defaultWaits
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--run') args.run = true;
		else if (arg === '--keep') args.keep = true;
		else if (arg === '--create-target-dir') args.createTargetDir = true;
		else if (arg === '--hidden') args.hidden = true;
		else if (arg === '--extension')
			args.extension = normalizeExtension(readValue(argv, ++index, arg));
		else if (arg === '--only') args.only = parseOnly(readValue(argv, ++index, arg));
		else if (arg === '--waits') args.waits = parseWaits(readValue(argv, ++index, arg));
		else if (arg === '--plan') args.planId = readValue(argv, ++index, arg);
		else if (arg === '--row') args.rowId = readValue(argv, ++index, arg);
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
  pnpm tsx scripts/probes/webdav-direct-move-probe.ts [--run] [--plan <id>] [--row <id>]

Options:
  --run                Actually create and move .renarr-probe-* files. Default is dry-run.
  --plan <id>          Use rows from a specific rename plan.
  --row <id>           Use a specific rename plan item.
  --create-target-dir  Create the target directory if the sampled plan target dir is missing.
  --hidden             Use .renarr-probe-* hidden names instead of renarr-probe-* names.
  --extension <ext>     Probe file extension. Default: .txt
  --only <tests>        Comma list: same_dir_rename,cross_dir_same_basename,cross_dir_direct_rename
  --waits <ms>          Comma wait snapshots. Default: 0,5000,10000,30000
  --keep               Do not delete probe files after the run.
`);
}

function readValue(argv: string[], index: number, flag: string) {
	const value = argv[index];
	if (!value) throw new Error(`Missing value for ${flag}`);
	return value;
}

function shouldRun(args: ProbeArgs, name: string) {
	return args.only.size === 0 || args.only.has(name);
}

function parseOnly(value: string) {
	return new Set(
		value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)
	);
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

function normalizeExtension(value: string) {
	const trimmed = value.trim();
	if (!trimmed) throw new Error('--extension cannot be empty');
	return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
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

async function safeDelete(
	client: ReturnType<typeof createClient>,
	remotePath: string,
	errors: string[]
) {
	try {
		if (await client.exists(remotePath)) await client.deleteFile(remotePath);
	} catch (error) {
		errors.push(`${remotePath}: ${stringifyError(error)}`);
	}
}

async function listPresence(
	client: ReturnType<typeof createClient>,
	source: string,
	target: string
) {
	const sourceDirectory = dirname(source);
	const targetDirectory = dirname(target);
	const sourceBase = basename(source);
	const targetBase = basename(target);
	let sourceListed = false;
	let targetListed = false;
	let sourceListError: string | undefined;
	let targetListError: string | undefined;

	try {
		sourceListed = await directoryContains(client, sourceDirectory, sourceBase);
	} catch (error) {
		sourceListError = stringifyError(error);
	}

	try {
		if (targetDirectory === sourceDirectory) {
			targetListed =
				targetBase === sourceBase
					? sourceListed
					: await directoryContains(client, targetDirectory, targetBase);
		} else {
			targetListed = await directoryContains(client, targetDirectory, targetBase);
		}
	} catch (error) {
		targetListError = stringifyError(error);
	}

	return {
		sourceListed,
		targetListed,
		...(sourceListError ? { sourceListError } : {}),
		...(targetListError ? { targetListError } : {})
	};
}

async function directoryContains(
	client: ReturnType<typeof createClient>,
	directory: string,
	entryName: string
) {
	const result = await client.getDirectoryContents(directory);
	const entries = Array.isArray(result) ? result : result.data;
	return entries.some((entry) => entry.basename === entryName);
}

function joinRemote(...parts: string[]) {
	const joined = posix.normalize(posix.join(...parts));
	return joined.startsWith('/') ? joined : `/${joined}`;
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
