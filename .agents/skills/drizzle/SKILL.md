---
name: drizzle
description: Use for Renarr Drizzle ORM and SQLite work sqliteTable schemas, better-sqlite3 Drizzle setup, query style, indexes, inferred types, SQLite column choices, Drizzle v1 RC API differences, relations, and deciding between Drizzle builders and raw better-sqlite3 SQL.
---

# Renarr Drizzle Guide

## Project Context

- App: single SvelteKit app with a worker entry.
- Database: SQLite via `better-sqlite3`.
- Drizzle setup: `src/lib/server/db/index.ts` keeps the raw SQLite connection private and exports `getDb()` as `drizzle({ client, schema })`.
- Schema file: `src/lib/server/db/schema.ts`.
- Drizzle-kit config: root `drizzle.config.ts`.
- Migration workflow: beta uses `pnpm run db:push`; formal release uses `pnpm run db:generate` and `pnpm run db:migrate` with committed root `drizzle/` artifacts.
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

For every schema edit:

- Update Drizzle schema in `src/lib/server/db/schema.ts`.
- Update service/API/domain types that read or write the changed shape.
- During beta, run `pnpm run db:push` to sync the local SQLite schema.
- For formal release migration history, run `pnpm run db:generate`, commit `drizzle/`, and apply with `pnpm run db:migrate`.

Do not add hand-written `migrate(db)` DDL back into `src/lib/server/db/index.ts`.

## Column Choices

- IDs: use application-generated text IDs unless an existing table already has a different contract.
- Booleans: use `integer('column_name', { mode: 'boolean' })`; in SQL use `integer not null default 0` or `1`.
- Timestamps: use `text` ISO strings to match current tables.
- Product states: use `text(..., { enum: [...] })` only when the value set is small and stable enough for local schema typing; otherwise use `text()` plus shared TypeScript/Zod types.
- JSON payloads: current tables store JSON as `text` columns with `_json` suffix. Keep that convention unless introducing a broader JSON abstraction.
- Counts: use `integer(...).notNull()` and make SQL defaults explicit when old rows need backfill behavior.

Keep TypeScript unions and Zod schemas aligned with Drizzle schema choices. Drizzle SQLite enum typing is local typing; if runtime enforcement matters, add an explicit Drizzle-supported constraint or enforce it at the service/API layer.

## Indexes and Constraints

Use the callback array form for indexes and table constraints:

```ts
(table) => [uniqueIndex('library_item_identity').on(table.libraryPathId, table.topLevelPath)]
```

Every meaningful index/unique constraint belongs in `schema.ts`; drizzle-kit reads this file for push/generate.

Use foreign keys only when the app depends on database enforcement. If relying on cascades, confirm SQLite foreign keys are enabled in the runtime connection before assuming they fire.

## Query Style

Production services and route server code should use Drizzle builders through `getDb()`:

- Use explicit `select().from().where()` for simple reads.
- Use `insert().values()`, `update().set().where()`, and `delete().where()` for writes.
- Keep returned DTO shape stable; map Drizzle camelCase rows to existing API payloads when needed.
- Avoid relational query magic unless the task explicitly needs relations.

Drizzle v1 removed Relational Queries v1; use `defineRelations` only when a task explicitly needs relational query support.

```ts
const item = getDb().select().from(libraryItems).where(eq(libraryItems.id, itemId)).get();
```

For parent/child reads, two clear queries are usually better than hiding behavior in relation loading:

```ts
const plan = db.select().from(renamePlans).where(eq(renamePlans.id, planId)).get();
const rows = db.select().from(renamePlanItems).where(eq(renamePlanItems.planId, planId)).all();
```

## Raw SQL

Raw SQL is not part of the production service-layer API. Acceptable exceptions are:

- private SQLite connection initialization in `src/lib/server/db/index.ts` for pragmas;
- drizzle-kit internals and future formal migration tooling;
- test helpers such as `src/lib/server/test-db.ts`;
- future formal compatibility tests that need to construct an old schema shape.

When using raw SQL, keep it reviewable:

- Use parameters for user-controlled values.
- Keep selected row interfaces narrow and local.
- Prefer named helper functions over repeated SQL string fragments.
- Do not expand raw SQL back into `$lib/server/services` or route server handlers.

## Drizzle v1 RC Notes

Check official docs before using version-sensitive APIs:

- `https://orm.drizzle.team/docs/sqlite/upgrade-v1`
- `https://orm.drizzle.team/docs/sqlite/v0-v1-changes`
- `https://orm.drizzle.team/docs/sqlite/migrations`

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
