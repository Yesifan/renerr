## Why

Renarr 当前的数据库结构一部分在 Drizzle schema，一部分只存在于 `better-sqlite3` 手写 SQL，业务服务也大量直接使用 `db.prepare(...)`。这让 schema、迁移、查询类型和 agent/skill 文档无法保持同一套约束。

项目仍处于 beta 阶段，正式发布前不承诺数据库或 API 无损兼容；现在是把数据库层整理为 Drizzle schema + drizzle-kit migration + Drizzle API 查询边界的合适时机。

## What Changes

- **BREAKING**：不支持已有开发期 SQLite 数据库无损升级；旧库不兼容时直接重建。
- **BREAKING**：删除 beta 期间废弃的 legacy 数据修正逻辑和对应旧库迁移测试。
- 补全 `src/lib/server/db/schema.ts`，让所有 SQLite 表、索引和约束都由 Drizzle schema 表达。
- 新增仓库根目录 `drizzle.config.ts`；beta 阶段通过 `drizzle-kit push` 直接同步本地 SQLite schema。
- 补全 `package.json` 中的 `db:push` 命令；同时预留正式版使用的 `db:generate` 和 `db:migrate` 命令。
- 正式发布前再切换到 Drizzle SQLite migrations 官方文档的 codebase-first migration 模式：`db:generate` 生成 `drizzle/` migration artifacts，`db:migrate` 应用已提交 migration。
- 正式版前如果临时生成过 migration，每次重新生成前先删除旧的 `drizzle/` 迁移文件，避免 beta 阶段累积无意义的开发迁移历史。
- 移除应用启动时的手写 `migrate(db)` 建表逻辑；beta 阶段数据库结构由开发者运行 `db:push` 同步。
- 收紧 DB 边界：生产服务层通过 `getDb()` 和 Drizzle API 访问数据库，不再公开 raw `getSqlite()` 给业务代码。
- 分两层实施：先完成 DB/migration 基础层，再逐个服务把手写 SQL 查询替换为 Drizzle builder，期间不夹带业务规则变更。
- 更新 DB 相关 agent 指令、`db-migrations` skill、`drizzle` skill、README/ADR，使代码和文档同步反映最终边界。

## Capabilities

### New Capabilities

- `database-persistence`: 定义 Renarr SQLite schema、drizzle-kit migration、Drizzle API 查询边界、beta 兼容策略和文档同步规则。

### Modified Capabilities

- `scan-and-organize`: 移除旧 `failed` item 迁移兼容 requirement；beta 阶段旧库直接重建，不保留 legacy migration 行为。

## Impact

- Affected code:
  - `src/lib/server/db/schema.ts`
  - `src/lib/server/db/index.ts`
  - `src/lib/server/services/**`
  - DB 相关 route handlers 和 server load/action 调用链
  - DB 相关测试，尤其 `src/lib/server/services/v1-core-flows.test.ts` 和 `src/lib/server/route-boundaries.test.ts`
- New files/directories:
  - `drizzle.config.ts`
  - `drizzle/`（正式版生成 migration 时纳入 git；beta 阶段可不存在）
  - OpenSpec delta specs for database persistence and scan/organize legacy behavior
- Documentation and agent updates:
  - `AGENTS.md`
  - `README.md`
  - `docs/adr/0001-beta-database-api-compatibility.md`
  - `.agents/skills/db-migrations/SKILL.md`
  - `.agents/skills/drizzle/SKILL.md`
- Dependencies/commands:
  - Use existing `drizzle-kit` and `drizzle-orm` v1 RC packages from `package.json`.
  - Add `db:push`, `db:generate`, and `db:migrate` scripts to `package.json`.
  - During beta, use `db:push`; for formal releases, commit generated `drizzle/` migration artifacts.
  - Reference official Drizzle SQLite migrations docs: `https://orm.drizzle.team/docs/sqlite/migrations`.
