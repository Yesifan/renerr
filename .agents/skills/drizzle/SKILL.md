---
name: drizzle
description: Use for Renarr Drizzle ORM and SQLite work sqliteTable schemas, better-sqlite3 Drizzle setup, query style, indexes, inferred types, SQLite column choices, Drizzle v1 RC API differences, relations, and deciding between Drizzle builders and raw better-sqlite3 SQL.
---

# Renarr Drizzle Guide

## Project Context

- App: single SvelteKit app with a worker entry.
- Database: SQLite via `better-sqlite3`.
- Drizzle setup: `src/lib/server/db/index.ts` uses `drizzle(getSqlite(), { schema })`.
- Schema file: `src/lib/server/db/schema.ts`.
- Runtime migration path: hand-written `better-sqlite3` SQL in `migrate(db)`.
- Package versions can differ from examples. Check `package.json` first; this project is on Drizzle v1 RC packages.
- Detailed migration workflow lives in the `db-migrations` skill.

## Schema Style

Use `sqliteTable` from `drizzle-orm/sqlite-core`. Keep table and column names snake_case in SQL and camelCase in TypeScript field names.

```ts
export const libraryItems = sqliteTable(
  'library_items',
  {
    id: text('id').primaryKey(),
    libraryPathId: text('library_path_id').notNull(),
    topLevelPath: text('top_level_path').notNull(),
    videoFileCount: integer('video_file_count').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [uniqueIndex('library_item_identity').on(table.libraryPathId, table.topLevelPath)]
);
```

For every schema edit, update both:

- Drizzle schema in `src/lib/server/db/schema.ts`.
- Runtime DDL/migration SQL in `src/lib/server/db/index.ts`.

Drizzle schema alone does not change the SQLite database in the current project.

## Column Choices

- IDs: use application-generated text IDs unless an existing table already has a different contract.
- Booleans: use `integer('column_name', { mode: 'boolean' })`; in SQL use `integer not null default 0` or `1`.
- Timestamps: use `text` ISO strings to match current tables.
- Product states: use `text(..., { enum: [...] })` only when the value set is small and stable enough for local schema typing; otherwise use `text()` plus shared TypeScript/Zod types.
- JSON payloads: current tables store JSON as `text` columns with `_json` suffix. Keep that convention unless introducing a broader JSON abstraction.
- Counts: use `integer(...).notNull()` and make SQL defaults explicit when old rows need backfill behavior.

Keep CHECK constraints in raw SQL aligned with TypeScript unions and Zod schemas. Drizzle SQLite enum typing does not replace runtime SQLite constraints.

## Indexes and Constraints

Use the callback array form for indexes and table constraints:

```ts
(table) => [uniqueIndex('library_item_identity').on(table.libraryPathId, table.topLevelPath)]
```

Mirror every meaningful index/unique constraint in the SQL migration path. In SQLite DDL, use `create index if not exists` or `create unique index if not exists` when adding standalone indexes.

Use foreign keys only when the app depends on database enforcement. If relying on cascades, confirm SQLite foreign keys are enabled in the runtime connection before assuming they fire.

## Query Style

Prefer the simplest query surface that fits the surrounding service:

- Use Drizzle builders for new typed CRUD where schema coupling helps.
- Keep `better-sqlite3` prepared statements where existing services already use them, where synchronous worker behavior is clearer, or where raw SQLite is materially simpler.
- Avoid mixing Drizzle and raw SQL in the same function unless there is a concrete benefit.

For Drizzle builders, prefer explicit `select().from().where()` over relational query magic. Drizzle v1 removed Relational Queries v1; use `defineRelations` only when a task explicitly needs relational query support.

```ts
const [item] = await db
  .select()
  .from(libraryItems)
  .where(eq(libraryItems.id, itemId))
  .limit(1);
```

For parent/child reads, two clear queries are usually better than hiding behavior in relation loading:

```ts
const [plan] = await db.select().from(renamePlans).where(eq(renamePlans.id, planId)).limit(1);
const rows = await db.select().from(renamePlanItems).where(eq(renamePlanItems.planId, planId));
```

## Raw SQL

Raw SQL is acceptable for:

- boot-time SQLite DDL in `migrate(db)`;
- SQLite table rebuild migrations;
- operations where Drizzle v1 RC lacks a clean builder;
- performance-sensitive existing service code using prepared statements.

When using raw SQL, keep it reviewable:

- Use parameters for user-controlled values.
- Keep selected row interfaces narrow and local.
- Prefer named helper functions over repeated SQL string fragments.
- Add focused regression tests for data migrations and non-trivial updates.

## Drizzle v1 RC Notes

Check official docs before using version-sensitive APIs:

- `https://orm.drizzle.team/docs/sqlite/upgrade-v1`
- `https://orm.drizzle.team/docs/sqlite/v0-v1-changes`

Relevant v1 changes:

- Relational Queries v1 is removed; v2 uses `defineRelations`.
- Legacy `drizzle({ casing: 'camelCase' })` is replaced by table/view/schema-level casing APIs. Renarr currently names columns explicitly, so do not add global casing.
- `getTableColumns` is deprecated in favor of `getColumns`.
- Generated migrations use the v1/v3 folder structure after `drizzle-kit up`; this matters only if Renarr adopts generated migrations.

## Tests and Verification

Schema-affecting changes need tests that prove the data shape, not just TypeScript compilation. Prefer tests that exercise the public service/API behavior using a temporary SQLite database.

Before finishing, run the verification commands listed in `AGENTS.md` when feasible:

```sh
pnpm run check
pnpm test
pnpm build
pnpm run build:worker
```
