---
name: db-migrations
description: Use for Renarr database changes SQLite schema/table/column/index changes, Drizzle schema updates, drizzle-kit push/generate/migrate workflow, Drizzle v1 migration folder upgrades, rebase conflicts, and migration SQL review.
---

# Renarr Database Migrations

## Project Context

- Database: SQLite through `better-sqlite3`.
- Drizzle packages: verify `package.json`; this project currently uses Drizzle v1 RC packages, so check official docs before applying version-sensitive APIs.
- Drizzle schema: `src/lib/server/db/schema.ts`.
- Drizzle config: root `drizzle.config.ts`.
- Runtime DB setup: `src/lib/server/db/index.ts` opens `better-sqlite3`, sets pragmas, and returns a Drizzle client through `getDb()`. It does not run hand-written schema migrations.
- Beta state: no committed migration history is required. Use `db:push` to sync the current schema to a local SQLite database.
- Formal release path: use `db:generate` and `db:migrate`; generated root `drizzle/` migration artifacts must be committed.
- Official Drizzle v1 SQLite references:
  - `https://orm.drizzle.team/docs/sqlite/migrations`
  - `https://orm.drizzle.team/docs/sqlite/upgrade-v1`
  - `https://orm.drizzle.team/docs/sqlite/v0-v1-changes`

## Default Workflow

For every schema change, keep the type loop closed:

1. Update `src/lib/server/db/schema.ts`.
2. During beta, run `pnpm run db:push` against the target local SQLite database.
3. For a formal release migration, run `pnpm run db:generate` and commit the generated `drizzle/` artifacts, then use `pnpm run db:migrate` to apply committed migrations.
4. Update domain schemas/types in `src/lib/schemas/domain.ts` when API/UI payloads change.
5. Update service and API code that reads or writes the changed table.
6. Add or update focused regression tests, usually near `src/lib/server/services/v1-core-flows.test.ts` or route-boundary tests.
7. Run the project verification commands from `AGENTS.md` when feasible.

During beta, if a generated `drizzle/` folder exists only as draft migration history, delete it before regenerating a new formal-release baseline. Do not accumulate meaningless beta migration churn.

## Beta Push Workflow

Beta development does not promise lossless SQLite upgrades. If a local development database is incompatible with the current schema, rebuild it and run:

```sh
pnpm run db:push
```

Use a temporary data directory when validating schema sync:

```sh
RENARR_DATA_DIR=/private/tmp/renarr-db-push-test pnpm run db:push --force
```

Do not add hand-written `migrate(db)` DDL back into `src/lib/server/db/index.ts`.

## SQLite Review Rules

- Use text IDs unless a table has a concrete reason to use another primary key shape.
- Store booleans as `integer(..., { mode: 'boolean' })` in Drizzle schema and `integer not null default 0/1` in SQL.
- Store timestamps as text ISO strings unless existing table semantics dictate otherwise.
- Keep TypeScript/Zod value unions aligned with Drizzle column choices.
- Add foreign keys in Drizzle schema when the app depends on database enforcement; ensure SQLite foreign key behavior is enabled before depending on cascades.
- Keep unique constraints/indexes in Drizzle schema.
- Preserve product migration decisions from `AGENTS.md`: beta can rebuild incompatible DBs, no old `failed` item compatibility migration is required, and formal release requires a compatibility review.

## Development Churn

Before a schema change ships as formal migration history, rewrite the in-progress schema to the final shape and rerun `db:push`.

After a generated migration has shipped as formal release history, treat it as production history:

- Do not remove or silently reinterpret existing compatibility SQL.
- Add a follow-up generated migration.
- Preserve data migration behavior for older databases.

## Formal drizzle-kit Migration Workflow

Before creating a formal release tag:

1. Update docs that say Renarr is beta.
2. Reconfirm DB/API compatibility policy.
3. Delete any draft beta `drizzle/` artifacts.
4. Run `pnpm run db:generate`.
5. Commit generated SQL/snapshots/metadata under root `drizzle/`.
6. Use `pnpm run db:migrate` to apply committed migrations.

For an existing Drizzle v0 migration folder, run `drizzle-kit up` once to convert it to the v1/v3 folder structure. Drizzle v1 removes `journal.json`, groups SQL and snapshots into migration folders, removes `drizzle-kit drop`, and matches applied migrations by full folder name instead of timestamp. This does not apply to Renarr until a generated migration folder exists.

Future formal compatibility tests may use raw SQL in test helpers to construct old schema shapes. Keep that exception out of production services.

## Rebase Conflicts

For beta schema work, rebase conflicts are ordinary code conflicts in `schema.ts`, services, and tests:

- Keep upstream schema decisions.
- Reapply this branch's schema change after the upstream code.
- Verify an empty/new database with `db:push`.

For formal generated Drizzle migrations, keep upstream/default-branch migrations, remove this branch's generated draft migrations, finish the rebase, then regenerate this branch's migration from the rebased schema.
