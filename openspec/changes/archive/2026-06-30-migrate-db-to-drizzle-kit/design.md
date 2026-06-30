## Context

Renarr 目前使用 SQLite + `better-sqlite3`，并已引入 Drizzle schema，但 schema 只覆盖部分表。启动时 `src/lib/server/db/index.ts` 通过手写 `db.exec(...)` 建表和执行 legacy 数据修正，业务服务层大量直接调用 `getSqlite().prepare(...)`。

项目已明确处于 beta 阶段：正式发布前数据库和 API 不承诺无损升级或向后兼容，旧开发库不兼容时可以直接重建。因此这次改造可以生成干净的初始 Drizzle migration，不需要把已废弃状态或旧库修正逻辑带入新迁移历史。

Drizzle 官方 SQLite migrations 文档提供 codebase-first 的多种路线。Renarr 在 beta 阶段选择更轻的 `drizzle-kit push`：TypeScript schema 是源，开发者直接把当前 schema 推到本地 SQLite。正式发布前再切到生成并提交 migration artifacts 的 `generate`/`migrate` 流程。

## Goals / Non-Goals

**Goals:**

- 让 `src/lib/server/db/schema.ts` 成为全部 SQLite 表、索引和约束的唯一真实来源。
- 使用根目录 `drizzle.config.ts` 配置 drizzle-kit。
- 在 `package.json` 提供 beta 阶段使用的 `db:push`，并预留正式版使用的 `db:generate` 和 `db:migrate` 命令。
- 移除手写 `migrate(db)` 建表逻辑；beta 阶段通过显式 `db:push` 同步本地 schema，正式版再使用 migration artifacts。
- 生产服务层统一使用 `getDb()` 和 Drizzle API，raw `better-sqlite3` handle 不再作为业务代码公共接口。
- 删除当前 beta 阶段的 legacy 旧库迁移测试和废弃数据修正。
- 在实现完成后同步更新 `AGENTS.md`、README、ADR、`db-migrations` skill 和 `drizzle` skill。

**Non-Goals:**

- 不支持已有开发期 SQLite 数据库无损升级。
- 不为 raw SQL 边界新增自动化检查脚本，边界依靠 agent 约定和 code review。
- 不改变媒体库扫描、识别、rename plan、worker 执行等业务规则。
- 不在这次改造中引入新的数据库引擎、ORM 抽象层或 repository 分层。

## Decisions

### 使用 Drizzle schema 作为唯一数据库结构来源

所有当前存在于手写 SQL 中的表都补全到 `schema.ts`：`app_settings`、`rename_plan_drafts`、`rename_plans`、`rename_plan_items`、`tasks`、`execution_records`、`logs` 以及已有表的索引/约束。这样 drizzle-kit diff、业务查询类型和迁移历史都依赖同一份定义。

备选方案是保留部分表只在 migration SQL 中定义，但这会继续迫使服务层为这些表写 raw SQL，也会让后续 schema diff 不可信。

### 使用根目录 drizzle-kit 配置

新增根目录 `drizzle.config.ts`。Renarr 是单仓单 SvelteKit app，不是 packages monorepo；根目录配置最接近 Drizzle 工具默认预期。正式版生成 migration 时，输出目录使用根目录 `drizzle/`，避免把生成 SQL/snapshot 混入 `src` 运行时代码或 `docs` 文档。

### beta 阶段使用 drizzle-kit push

beta 阶段不维护长期 migration history，`schema.ts` 是代码中的数据库结构源，`db:push` 包装 `drizzle-kit push`，开发者在 schema 改动后显式运行该命令把当前目标结构推到本地 SQLite 数据库。旧开发库不兼容时直接重建，不实现 baseline 或数据兼容迁移。

这个选择避免 beta 阶段频繁生成和删除 migration 文件，也符合当前“不承诺旧库兼容”的产品状态。

### 正式版使用 generate/migrate

正式发布前重新确认兼容策略并切到 Drizzle migration flow：`db:generate` 包装 `drizzle-kit generate`，读取上一次 migration folders、比较当前 schema 与上一快照、生成 SQL migration 并持久化到根目录 `drizzle/`；`db:migrate` 包装 `drizzle-kit migrate`，用于应用已生成 migration。正式版生成的 `drizzle/` migration artifacts 是源代码的一部分，必须纳入 git 管理。

正式发布版本前如果临时生成过 migration，重新生成前应删除旧的 `drizzle/` 迁移文件，再生成新的当前目标 schema migration，避免 beta 阶段累积无意义的开发迁移历史。

### 初始迁移面向新库，不兼容旧开发库

beta 阶段不生成需要长期维护的初始 migration。因为项目仍处于 beta 阶段，不实现“已有库标记 baseline”或旧 `failed` 状态兼容迁移；如果本地旧库不匹配，开发者重建数据库并运行 `db:push`。

备选方案是实现旧库 baseline 和数据修正，但会把 beta 阶段废弃状态固化进正式迁移历史，并增加实现复杂度。

### 收紧 DB public surface

生产服务层只通过 `getDb()` 使用 Drizzle API。底层 `better-sqlite3` connection 只用于必要 DB 初始化、正式版迁移工具和少量测试辅助场景；未来正式兼容阶段如果需要构造旧 schema 迁移测试，测试辅助代码可以使用 raw SQL。

### 分两层实施

第一层完成 schema 补全、drizzle-kit 配置、`db:push`/正式版 migration scripts、移除手写 `migrate(db)` 和 raw handle 边界。第二层逐个服务把 `prepare`/`exec` 查询替换为 Drizzle builder。两层之间不夹带业务规则变更，失败时更容易定位到 schema/类型/查询转换问题。

### 文档和技能必须随实现收敛

实现完成后，`AGENTS.md`、README、ADR、`.agents/skills/db-migrations/SKILL.md` 和 `.agents/skills/drizzle/SKILL.md` 必须反映最终代码结构。尤其要移除“当前仍手写 migrate(db)”这类过时描述，并记录 beta 兼容策略、根目录 `drizzle/`、Drizzle API 查询边界和正式 release 前需要重审兼容策略。

## Risks / Trade-offs

- **Drizzle v1 RC SQLite API 和官方文档存在版本差异** -> 实现前核对当前 `package.json` 版本，并用本地 `pnpm exec drizzle-kit push` 实际验证配置。
- **beta push 和正式 migration 职责混淆** -> `db:push` 是 beta 开发期主路径；`db:generate`/`db:migrate` 是正式版迁移路径，正式发布前重新确认并启用已提交 migration artifacts。
- **Drizzle builder 转换可能改变返回 shape 或布尔/JSON 映射** -> 服务层按文件逐个迁移，保留现有 DTO 和回归测试语义，重点检查 boolean integer、JSON text、nullable 字段和排序。
- **web/worker 双入口下 DB 初始化重复执行** -> 复用当前单连接初始化边界；beta 阶段不在应用启动时自动建表，schema 同步由显式 `db:push` 完成。
- **删除 legacy 迁移测试可能掩盖业务回归** -> 只删除旧库构造/迁移兼容测试，保留当前业务流测试并改成当前 schema 下的 Drizzle seed/assert。
- **文档提前或滞后于代码** -> 把 agent/skill/README 更新列入任务收尾阶段，并在最终 verification 前检查描述是否仍引用旧 `migrate(db)`、公共 `getSqlite()` 或缺少 beta `db:push` / 正式版 `db:generate`、`db:migrate` 规则。

## Migration Plan

1. 补全 Drizzle schema，确保当前所有表和约束都可由 schema 表达。
2. 新增 `drizzle.config.ts` 和 `package.json` 的 `db:push`、`db:generate`、`db:migrate` scripts；beta 阶段用 `db:push` 同步数据库。
3. 将 DB 初始化改成打开 SQLite、设置 pragmas、返回 Drizzle client，不再手写建表迁移。
4. 收起 raw SQLite public API，仅保留 migrator/必要测试辅助入口。
5. 逐个服务和 route 将手写 SQL 改为 Drizzle builder。
6. 删除 legacy 旧库迁移测试，更新剩余测试 seed/assert 到 Drizzle API。
7. 更新 agent、README、ADR 和 DB skills，保证文档与最终代码一致。
8. 运行 `pnpm run check`、`pnpm test`、`pnpm build`、`pnpm run build:worker`。
