import { getSqlite } from '$lib/server/db';
import { newId } from '$lib/server/id';
import { decryptCredential, encryptCredential } from '$lib/server/security/credentials';
import { nowIso } from '$lib/server/time';
import { libraryPathInputSchema, webdavSourceInputSchema } from '$lib/schemas/domain';
import { WebDavFileClient } from '$lib/server/integrations/webdav-client';
import { ApiError } from '$lib/server/api';
import { normalizeRemotePath } from './paths';
import { log } from './logs';

type SourceRow = {
	id: string;
	name: string;
	url: string;
	username: string;
	credential_encrypted: string;
	created_at: string;
	updated_at: string;
};

export function listSources() {
	return getSqlite()
		.prepare('select id, name, url, username, created_at, updated_at from webdav_sources order by name')
		.all()
		.map((row) => mapSource(row as SourceRow));
}

export function getSource(id: string) {
	const row = getSqlite().prepare('select * from webdav_sources where id = ?').get(id) as
		| SourceRow
		| undefined;
	if (!row) throw new Error('Source not found');
	return row;
}

export function getClientForSource(sourceId: string) {
	const source = getSource(sourceId);
	return new WebDavFileClient(source.url, source.username, decryptCredential(source.credential_encrypted));
}

export function upsertSource(input: unknown, id?: string) {
	const parsed = webdavSourceInputSchema.parse(input);
	const db = getSqlite();
	const existing = id ? (db.prepare('select * from webdav_sources where id = ?').get(id) as SourceRow) : undefined;
	if (id && !existing) throw new Error('Source not found');
	if (!parsed.credential && !existing) throw new Error('Credential is required');
	const now = nowIso();
	const sourceId = id || newId();
	db.prepare(
		`insert into webdav_sources (id, name, url, username, credential_encrypted, created_at, updated_at)
		 values (@id, @name, @url, @username, @credentialEncrypted, @createdAt, @updatedAt)
		 on conflict(id) do update set
		 name = excluded.name, url = excluded.url, username = excluded.username,
		 credential_encrypted = excluded.credential_encrypted, updated_at = excluded.updated_at`
	).run({
		id: sourceId,
		name: parsed.name,
		url: parsed.url,
		username: parsed.username,
		credentialEncrypted: parsed.credential
			? encryptCredential(parsed.credential)
			: existing?.credential_encrypted,
		createdAt: existing?.created_at || now,
		updatedAt: now
	});
	return mapSource(db.prepare('select * from webdav_sources where id = ?').get(sourceId) as SourceRow);
}

export async function testWebdavConnection(input: unknown, id?: string) {
	const parsed = webdavSourceInputSchema.parse(input);
	const existing = id ? (getSqlite().prepare('select * from webdav_sources where id = ?').get(id) as SourceRow) : undefined;
	const credential = parsed.credential || (existing ? decryptCredential(existing.credential_encrypted) : '');
	if (!credential) throw new ApiError('validation_failed', 'Credential is required', 400);
	const client = new WebDavFileClient(parsed.url, parsed.username, credential);
	try {
		await client.listDirectory('/');
	} catch (error) {
		log('error', 'WebDavClient', 'WebDAV connection test failed', {
			url: parsed.url,
			username: parsed.username,
			error: error instanceof Error ? error.message : String(error)
		});
		throw new ApiError('webdav.connection_failed', 'WebDAV connection failed', 400);
	}
	return { ok: true };
}

export async function testLibraryPath(input: unknown) {
	const parsed = libraryPathInputSchema.pick({ sourceId: true, path: true }).parse(input);
	const client = getClientForSource(parsed.sourceId);
	try {
		await client.listDirectory(normalizeRemotePath(parsed.path));
		return { ok: true };
	} catch (error) {
		log('error', 'WebDavClient', 'WebDAV library path test failed', {
			sourceId: parsed.sourceId,
			path: normalizeRemotePath(parsed.path),
			error: error instanceof Error ? error.message : String(error)
		});
		throw new ApiError('webdav.path_unreadable', 'WebDAV path is not readable', 400);
	}
}

export async function browseWebdav(sourceId: string, path: string) {
	const client = getClientForSource(sourceId);
	const entries = await client.listDirectory(normalizeRemotePath(path));
	const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
	return entries
		.filter((entry) => entry.type === 'directory')
		.sort((a, b) => collator.compare(a.basename, b.basename));
}

export function listLibraries() {
	return (
		getSqlite()
		.prepare(
			`select lp.*, s.name as source_name
			 from library_paths lp join webdav_sources s on s.id = lp.source_id
			 order by s.name, lp.path`
		)
			.all() as Record<string, unknown>[]
	).map(mapLibrary);
}

export function getLibrary(id: string) {
	const row = getSqlite()
		.prepare(
			`select lp.*, s.name as source_name
			 from library_paths lp join webdav_sources s on s.id = lp.source_id
			 where lp.id = ?`
		)
		.get(id);
	if (!row) throw new Error('Library path not found');
	return mapLibrary(row as Record<string, unknown>);
}

export function createLibrary(input: unknown) {
	const parsed = libraryPathInputSchema.parse(input);
	const id = newId();
	const now = nowIso();
	getSqlite()
		.prepare(
			`insert into library_paths (id, source_id, path, media_type, auto_organize, created_at, updated_at)
			 values (@id, @sourceId, @path, @mediaType, @autoOrganize, @createdAt, @updatedAt)`
		)
		.run({
			id,
			sourceId: parsed.sourceId,
			path: normalizeRemotePath(parsed.path),
			mediaType: parsed.mediaType,
			autoOrganize: parsed.autoOrganize ? 1 : 0,
			createdAt: now,
			updatedAt: now
		});
	return getLibrary(id);
}

export function updateLibrary(id: string, input: unknown) {
	const parsed = libraryPathInputSchema.partial().pick({ autoOrganize: true }).parse(input);
	const existing = getLibrary(id);
	const now = nowIso();
	getSqlite()
		.prepare(
			`update library_paths
			 set auto_organize = @autoOrganize, updated_at = @updatedAt
			 where id = @id`
		)
		.run({
			id: existing.id,
			autoOrganize: (parsed.autoOrganize ?? existing.autoOrganize) ? 1 : 0,
			updatedAt: now
		});
	return getLibrary(id);
}

function mapSource(row: SourceRow) {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		username: row.username,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapLibrary(row: Record<string, unknown>) {
	return {
		id: String(row.id),
		sourceId: String(row.source_id),
		sourceName: String(row.source_name),
		path: String(row.path),
		mediaType: row.media_type as 'movie' | 'tv',
		autoOrganize: Boolean(row.auto_organize),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at)
	};
}
