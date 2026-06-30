---
name: db-migrations
description: Use for Renarr database changes SQLite schema/table/column/index changes, Drizzle schema updates, better-sqlite3 boot migrations, future drizzle-kit migration setup, Drizzle v1 migration folder upgrades, rebase conflicts, and migration SQL review.
---

# Renarr Database Migrations

## Project Context

- Database: SQLite through `better-sqlite3`.
- Drizzle packages: verify `package.json`; this project currently uses Drizzle v1 RC packages, so check official docs before applying version-sensitive APIs.
- Drizzle schema: `src/lib/server/db/schema.ts`.
- Runtime DB setup and current migrations: `src/lib/server/db/index.ts`.
- Current state: no `drizzle.config.ts` and no generated migration folder. The app creates/patches schema in `migrate(db)` with `db.exec(...)`.
- Official Drizzle v1 SQLite references:
  - `https://orm.drizzle.team/docs/sqlite/upgrade-v1`
  - `https://orm.drizzle.team/docs/sqlite/v0-v1-changes`

## Default Workflow

For every schema change, keep the type loop closed:

1. Update `src/lib/server/db/schema.ts`.
2. Update `migrate(db)` in `src/lib/server/db/index.ts` with SQLite-compatible SQL.
3. Update domain schemas/types in `src/lib/schemas/domain.ts` when API/UI payloads change.
4. Update service and API code that reads or writes the changed table.
5. Add or update focused regression tests, usually near `src/lib/server/services/v1-core-flows.test.ts` or route-boundary tests.
6. Run the project verification commands from `AGENTS.md` when feasible.

Prefer one coherent migration block per feature. Avoid unrelated schema cleanup in the same change.

## Current better-sqlite3 Migration Style

Use `create table if not exists` for baseline tables. For existing databases, add explicit patch statements after the baseline DDL.

SQLite lacks many PostgreSQL idempotent clauses. Do not blindly copy Postgres patterns such as `ADD COLUMN IF NOT EXISTS`. For SQLite, guard additive changes by checking `pragma_table_info` in TypeScript before running `alter table`.

```ts
const columns = db
  .prepare("select name from pragma_table_info('library_items')")
  .all() as { name: string }[];

if (!columns.some((column) => column.name === 'new_column')) {
  db.exec("alter table library_items add column new_column text");
}
```

For indexes, use SQLite's `create index if not exists` / `create unique index if not exists`.

For destructive or shape-changing migrations, prefer the SQLite table-rebuild pattern:

1. Create a new table with the desired shape.
2. Copy and transform data explicitly.
3. Drop the old table.
4. Rename the new table.
5. Recreate indexes.

Wrap multi-step data changes in a transaction when partial application would corrupt state. `better-sqlite3` supports `db.transaction(...)`; use it for procedural migrations and keep `db.exec(...)` for simple static DDL.

## SQLite Review Rules

- Use text IDs unless a table has a concrete reason to use another primary key shape.
- Store booleans as `integer(..., { mode: 'boolean' })` in Drizzle schema and `integer not null default 0/1` in SQL.
- Store timestamps as text ISO strings unless existing table semantics dictate otherwise.
- Keep CHECK constraints aligned with TypeScript value unions and Zod schemas.
- Add foreign keys in SQL when the relationship must be enforced; ensure SQLite foreign key behavior is actually enabled before depending on cascades.
- Keep unique constraints/indexes in both Drizzle schema and SQL DDL.
- Preserve product migration decisions from `AGENTS.md`, especially legacy `failed` item compatibility.

## Development Churn

Before a schema change has shipped to users or the default branch, rewrite the in-progress migration code to the final shape instead of layering compatibility for every draft iteration.

After a migration has shipped or reached the default branch, treat it as production history:

- Do not remove or silently reinterpret existing compatibility SQL.
- Add a follow-up guarded migration.
- Preserve data migration behavior for older databases.

## Future drizzle-kit Adoption

If this project adopts generated Drizzle migrations later, do that as a separate infrastructure change:

1. Add `drizzle.config.ts` for SQLite and point it at `src/lib/server/db/schema.ts`.
2. Decide the migration output directory before generating anything.
3. Use the installed Drizzle v1 RC-compatible CLI, e.g. `pnpm exec drizzle-kit generate`.
4. Wire runtime migration execution for `better-sqlite3`.
5. Keep or replace the existing `migrate(db)` path intentionally; do not run two independent migration systems against the same database.

For an existing Drizzle v0 migration folder, run `drizzle-kit up` once to convert it to the v1/v3 folder structure. Drizzle v1 removes `journal.json`, groups SQL and snapshots into migration folders, removes `drizzle-kit drop`, and matches applied migrations by full folder name instead of timestamp. This does not apply to Renarr until a generated migration folder exists.

## Rebase Conflicts

For current hand-written migrations, rebase conflicts are ordinary code conflicts in `src/lib/server/db/index.ts` and `schema.ts`:

- Keep upstream shipped migration behavior.
- Reapply this branch's schema change after the upstream code.
- Verify an empty/new database and an older seeded database still migrate correctly.

For future generated Drizzle migrations, keep upstream/default-branch migrations, remove this branch's generated draft migrations, finish the rebase, then regenerate this branch's migration from the rebased schema.
