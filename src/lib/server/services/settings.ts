import { getSqlite } from '$lib/server/db';
import { nowIso } from '$lib/server/time';
import { settingsSchema, type AppSettings } from '$lib/schemas/domain';

export function getSettings(): AppSettings {
	const row = getSqlite().prepare('select value_json from app_settings where id = ?').get('global') as
		| { value_json: string }
		| undefined;
	return settingsSchema.parse(row ? JSON.parse(row.value_json) : {});
}

export function saveSettings(input: unknown) {
	const existing = getSettings();
	const patch = input && typeof input === 'object' ? (input as Partial<AppSettings>) : {};
	const settings = settingsSchema.parse({
		...existing,
		...patch,
		tmdbApiKey: patch.tmdbApiKey ? patch.tmdbApiKey : existing.tmdbApiKey
	});
	getSqlite()
		.prepare(
			`insert into app_settings (id, value_json, updated_at)
			 values ('global', @valueJson, @updatedAt)
			 on conflict(id) do update set value_json = excluded.value_json, updated_at = excluded.updated_at`
		)
		.run({ valueJson: JSON.stringify(settings), updatedAt: nowIso() });
	return settings;
}

export function publicSettings() {
	const settings = getSettings();
	return {
		...settings,
		tmdbApiKey: settings.tmdbApiKey ? `${settings.tmdbApiKey.slice(0, 4)}...${settings.tmdbApiKey.slice(-4)}` : ''
	};
}
