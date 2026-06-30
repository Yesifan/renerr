import { publicSettings } from '$lib/server/services/settings';
import { saveSettings } from '$lib/server/services/settings';
import {
	createLibrary,
	listLibraries,
	listSources,
	upsertSource
} from '$lib/server/services/sources';
import {
	libraryPathInputSchema,
	settingsPatchSchema,
	webdavSourceInputSchema
} from '$lib/schemas/domain';
import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load = (async () => {
	return {
		settings: publicSettings(),
		sources: listSources(),
		libraries: listLibraries()
	};
}) satisfies PageServerLoad;

function optionalString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === 'string' && value.length ? value : undefined;
}

function requiredString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === 'string' ? value : '';
}

function booleanValue(formData: FormData, key: string) {
	return formData.get(key) === 'true';
}

function actionError(error: unknown) {
	if (error instanceof ZodError) {
		return fail(400, {
			ok: false,
			code: 'validation_failed',
			issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
		});
	}
	return fail(400, {
		ok: false,
		code: 'unknown',
		message: error instanceof Error ? error.message : String(error)
	});
}

export const actions = {
	saveTmdb: async ({ request }) => {
		try {
			const formData = await request.formData();
			saveSettings(
				settingsPatchSchema.parse({ tmdbApiKey: optionalString(formData, 'tmdbApiKey') })
			);
			return { ok: true };
		} catch (error) {
			return actionError(error);
		}
	},
	saveFileSettings: async ({ request }) => {
		try {
			const formData = await request.formData();
			saveSettings(
				settingsPatchSchema.parse({
					namingLanguage: requiredString(formData, 'namingLanguage'),
					metadataEnabled: booleanValue(formData, 'metadataEnabled')
				})
			);
			return { ok: true };
		} catch (error) {
			return actionError(error);
		}
	},
	createLibrary: async ({ request }) => {
		try {
			const formData = await request.formData();
			return {
				ok: true,
				library: createLibrary(
					libraryPathInputSchema.parse({
						sourceId: requiredString(formData, 'sourceId'),
						path: requiredString(formData, 'path'),
						mediaType: requiredString(formData, 'mediaType'),
						autoOrganize: booleanValue(formData, 'autoOrganize')
					})
				)
			};
		} catch (error) {
			return actionError(error);
		}
	},
	createSource: async ({ request }) => {
		try {
			const formData = await request.formData();
			return {
				ok: true,
				source: upsertSource(
					webdavSourceInputSchema.parse({
						name: requiredString(formData, 'name'),
						url: requiredString(formData, 'url'),
						username: requiredString(formData, 'username'),
						credential: optionalString(formData, 'credential')
					})
				)
			};
		} catch (error) {
			return actionError(error);
		}
	}
} satisfies Actions;
