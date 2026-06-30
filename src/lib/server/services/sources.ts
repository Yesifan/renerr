import { asc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { libraryPaths, webdavSources } from '$lib/server/db/schema';
import { newId } from '$lib/server/id';
import { decryptCredential, encryptCredential } from '$lib/server/security/credentials';
import { nowIso } from '$lib/server/time';
import {
	libraryPathInputSchema,
	libraryPathUpdateSchema,
	webdavSourceInputSchema
} from '$lib/schemas/domain';
import { WebDavFileClient } from '$lib/server/integrations/webdav-client';
import { ApiError } from '$lib/server/api';
import { normalizeRemotePath } from './paths';
import { log } from './logs';

type SourceRow = {
	id: string;
	name: string;
	url: string;
	username: string;
	credentialEncrypted: string;
	createdAt: string;
	updatedAt: string;
};

export function listSources() {
	return getDb().select().from(webdavSources).orderBy(asc(webdavSources.name)).all().map(mapSource);
}

export function getSource(id: string) {
	const row = getDb().select().from(webdavSources).where(eq(webdavSources.id, id)).get();
	if (!row) throw new Error('Source not found');
	return row;
}

export function getClientForSource(sourceId: string) {
	const source = getSource(sourceId);
	return new WebDavFileClient(
		source.url,
		source.username,
		decryptCredential(source.credentialEncrypted)
	);
}

export function upsertSource(input: unknown, id?: string) {
	const parsed = webdavSourceInputSchema.parse(input);
	const db = getDb();
	const existing = id
		? db.select().from(webdavSources).where(eq(webdavSources.id, id)).get()
		: undefined;
	if (id && !existing) throw new Error('Source not found');
	if (!parsed.credential && !existing) throw new Error('Credential is required');
	const now = nowIso();
	const sourceId = id || newId();
	const values = {
		id: sourceId,
		name: parsed.name,
		url: parsed.url,
		username: parsed.username,
		credentialEncrypted: parsed.credential
			? encryptCredential(parsed.credential)
			: existing?.credentialEncrypted || '',
		createdAt: existing?.createdAt || now,
		updatedAt: now
	};
	db.insert(webdavSources)
		.values(values)
		.onConflictDoUpdate({
			target: webdavSources.id,
			set: {
				name: values.name,
				url: values.url,
				username: values.username,
				credentialEncrypted: values.credentialEncrypted,
				updatedAt: values.updatedAt
			}
		})
		.run();
	const row = db.select().from(webdavSources).where(eq(webdavSources.id, sourceId)).get();
	if (!row) throw new Error('Source not found');
	return mapSource(row);
}

export async function testWebdavConnection(input: unknown, id?: string) {
	const parsed = webdavSourceInputSchema.parse(input);
	const existing = id
		? getDb().select().from(webdavSources).where(eq(webdavSources.id, id)).get()
		: undefined;
	const credential =
		parsed.credential || (existing ? decryptCredential(existing.credentialEncrypted) : '');
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
	return getDb()
		.select({
			id: libraryPaths.id,
			sourceId: libraryPaths.sourceId,
			sourceName: webdavSources.name,
			path: libraryPaths.path,
			mediaType: libraryPaths.mediaType,
			autoOrganize: libraryPaths.autoOrganize,
			createdAt: libraryPaths.createdAt,
			updatedAt: libraryPaths.updatedAt
		})
		.from(libraryPaths)
		.innerJoin(webdavSources, eq(webdavSources.id, libraryPaths.sourceId))
		.orderBy(asc(webdavSources.name), asc(libraryPaths.path))
		.all()
		.map(mapLibrary);
}

export function getLibrary(id: string) {
	const row = getDb()
		.select({
			id: libraryPaths.id,
			sourceId: libraryPaths.sourceId,
			sourceName: webdavSources.name,
			path: libraryPaths.path,
			mediaType: libraryPaths.mediaType,
			autoOrganize: libraryPaths.autoOrganize,
			createdAt: libraryPaths.createdAt,
			updatedAt: libraryPaths.updatedAt
		})
		.from(libraryPaths)
		.innerJoin(webdavSources, eq(webdavSources.id, libraryPaths.sourceId))
		.where(eq(libraryPaths.id, id))
		.get();
	if (!row) throw new Error('Library path not found');
	return mapLibrary(row);
}

export function createLibrary(input: unknown) {
	const parsed = libraryPathInputSchema.parse(input);
	const id = newId();
	const now = nowIso();
	getDb()
		.insert(libraryPaths)
		.values({
			id,
			sourceId: parsed.sourceId,
			path: normalizeRemotePath(parsed.path),
			mediaType: parsed.mediaType,
			autoOrganize: parsed.autoOrganize,
			createdAt: now,
			updatedAt: now
		})
		.run();
	return getLibrary(id);
}

export function updateLibrary(id: string, input: unknown) {
	const parsed = libraryPathUpdateSchema.parse(input);
	const existing = getLibrary(id);
	const now = nowIso();
	getDb()
		.update(libraryPaths)
		.set({ autoOrganize: parsed.autoOrganize ?? existing.autoOrganize, updatedAt: now })
		.where(eq(libraryPaths.id, existing.id))
		.run();
	return getLibrary(id);
}

function mapSource(row: SourceRow) {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		username: row.username,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function mapLibrary(row: {
	id: string;
	sourceId: string;
	sourceName: string;
	path: string;
	mediaType: 'movie' | 'tv';
	autoOrganize: boolean;
	createdAt: string;
	updatedAt: string;
}) {
	return {
		id: row.id,
		sourceId: row.sourceId,
		sourceName: row.sourceName,
		path: row.path,
		mediaType: row.mediaType,
		autoOrganize: row.autoOrganize,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}
