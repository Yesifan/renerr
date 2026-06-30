## 1. 数据库基础层

- [x] 1.1 对照 Drizzle SQLite migrations 官方文档核对当前 `drizzle-orm`、`drizzle-kit` v1 RC 的 `push`、`generate`、`migrate` 配置和 SQLite 参数。
- [x] 1.2 补全 `src/lib/server/db/schema.ts`，覆盖 `webdav_sources`、`library_paths`、`library_items`、`app_settings`、`rename_plan_drafts`、`rename_plans`、`rename_plan_items`、`tasks`、`execution_records`、`logs` 的字段、索引和约束。
- [x] 1.3 新增根目录 `drizzle.config.ts`，指向 `src/lib/server/db/schema.ts`，迁移输出目录设为根目录 `drizzle/`。
- [x] 1.4 在 `package.json` 新增 `db:push`、`db:generate` 和 `db:migrate` 命令，分别包装 `drizzle-kit push`、`drizzle-kit generate` 和 `drizzle-kit migrate`。
- [x] 1.5 使用 `db:push` 在空 SQLite 数据库上验证当前 schema 能直接同步成功。
- [x] 1.6 确认 beta 阶段不提交 `drizzle/` migration artifacts；正式版使用 `db:generate` 时再纳入 git。
- [x] 1.7 移除 `src/lib/server/db/index.ts` 的手写 `migrate(db)` 建表逻辑，保留 SQLite pragmas 和 Drizzle client 初始化。
- [x] 1.8 收紧 DB 模块导出边界，让生产服务层只使用 `getDb()`，raw `better-sqlite3` connection 仅供 migrator/必要测试辅助代码内部使用。

## 2. 服务层 Drizzle API 化

- [x] 2.1 将 settings service 的 `getSqlite().prepare(...)` 查询和写入替换为 Drizzle builder，并保持 masked TMDB key 局部更新语义不变。
- [x] 2.2 将 sources/library path service 的 source、library path CRUD 和连接测试相关 DB 访问替换为 Drizzle builder，并保持 WebDAV source URL 原值语义不变。
- [x] 2.3 将 items service 的列表、详情、execution summary 查询和手动 identity 更新替换为 Drizzle builder，并保持 DTO shape 不变。
- [x] 2.4 将 scanner service 的 item 同步、状态流转、统计更新和 task enqueue 相关 DB 访问替换为 Drizzle builder，并保持扫描规则不变。
- [x] 2.5 将 planner service 的 draft/plan 创建、更新、提交和读取替换为 Drizzle builder，并保持 plan row JSON、selected rows 和冲突语义不变。
- [x] 2.6 将 executor service 的 plan item 状态、execution records、task summary 和 library item 摘要更新替换为 Drizzle builder，并保持失败只记录在任务/日志/records 中的语义不变。
- [x] 2.7 将 tasks、logs 和相关 route handler 中的 DB 访问替换为 Drizzle builder。
- [x] 2.8 检查生产路径中不再从 `$lib/server/db` 使用公共 raw SQLite handle，不保留生产服务层 `prepare(...)` 或 `exec(...)`。

## 3. 测试调整

- [x] 3.1 删除当前 beta 阶段旧库构造/legacy 迁移兼容测试，包括旧 `failed` item 迁移兼容断言。
- [x] 3.2 为测试提供当前 schema 下的 Drizzle seed/assert helper，减少测试中的直接 `db.prepare(...)`。
- [x] 3.3 更新 `v1-core-flows.test.ts`，让核心扫描、手动指定、rename plan 和执行流程在 Drizzle API 化后保持行为不变。
- [x] 3.4 更新 route-boundary tests，确保 server load/action/API 边界在 DB 访问替换后仍保持输入校验和 DTO 语义。

## 4. 文档和 Skill 同步

- [x] 4.1 更新 `AGENTS.md`，确保 beta 兼容策略、`drizzle.config.ts`、beta `db:push`、正式版 `db:generate`/`db:migrate`、正式版前生成前删除旧迁移、Drizzle schema 来源、DB public boundary、legacy 测试删除策略和 release tag 提醒与最终实现一致。
- [x] 4.2 更新 `README.md`，说明 beta 状态、数据库重建策略和正式发布前需要重新确认兼容策略。
- [x] 4.3 更新 `docs/adr/0001-beta-database-api-compatibility.md`，确保其描述与最终代码结构一致。
- [x] 4.4 更新 `.agents/skills/db-migrations/SKILL.md`，从“当前手写 `migrate(db)`”改为 beta `drizzle-kit push` 工作流，并记录正式版 `db:generate`/`db:migrate`、migration artifacts 纳入 git、正式版前生成前删除旧迁移，以及未来正式兼容阶段旧库测试 raw SQL 例外。
- [x] 4.5 更新 `.agents/skills/drizzle/SKILL.md`，记录完整 schema 来源、生产服务层 Drizzle API 查询边界和 raw SQL 例外范围。

## 5. 验证

- [x] 5.1 在空数据目录运行 `db:push`，确认 drizzle-kit 能创建完整 schema。
- [x] 5.2 运行 `pnpm run check`。
- [x] 5.3 运行 `pnpm test`。
- [x] 5.4 运行 `pnpm build`。
- [x] 5.5 运行 `pnpm run build:worker`。
