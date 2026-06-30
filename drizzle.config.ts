import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from './src/lib/server/env';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: getDatabasePath()
	}
});
