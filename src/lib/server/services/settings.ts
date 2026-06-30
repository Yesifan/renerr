import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { appSettings } from '$lib/server/db/schema';
import { nowIso } from '$lib/server/time';
import { settingsPatchSchema, settingsSchema, type AppSettings } from '$lib/schemas/domain';

export function getSettings(): AppSettings {
	const row = getDb()
		.select({ valueJson: appSettings.valueJson })
		.from(appSettings)
		.where(eq(appSettings.id, 'global'))
		.get();
	return settingsSchema.parse(row ? JSON.parse(row.valueJson) : {});
}

export function saveSettings(input: unknown) {
	const existing = getSettings();
	const patch = settingsPatchSchema.parse(input);
	const tmdbApiKey =
		typeof patch.tmdbApiKey === 'string' && isMaskedKey(patch.tmdbApiKey)
			? existing.tmdbApiKey
			: patch.tmdbApiKey
				? patch.tmdbApiKey
				: existing.tmdbApiKey;
	const settings = settingsSchema.parse({
		...existing,
		...patch,
		tmdbApiKey
	});
	const updatedAt = nowIso();
	getDb()
		.insert(appSettings)
		.values({ id: 'global', valueJson: JSON.stringify(settings), updatedAt })
		.onConflictDoUpdate({
			target: appSettings.id,
			set: { valueJson: JSON.stringify(settings), updatedAt }
		})
		.run();
	return settings;
}

function isMaskedKey(value: string) {
	return /^\S{1,8}\.\.\.\S{1,8}$/.test(value);
}

export function publicSettings() {
	const settings = getSettings();
	return {
		...settings,
		tmdbApiKey: settings.tmdbApiKey
			? `${settings.tmdbApiKey.slice(0, 4)}...${settings.tmdbApiKey.slice(-4)}`
			: ''
	};
}
