## ADDED Requirements

### Requirement: Drizzle schema 覆盖完整 SQLite 结构

系统 SHALL 使用 `src/lib/server/db/schema.ts` 表达 Renarr 当前 SQLite 数据库的全部表、索引和约束。

#### Scenario: 生成迁移前检查 schema

- **WHEN** 开发者为数据库结构生成 drizzle-kit migration
- **THEN** `schema.ts` MUST 包含所有生产表定义
- **AND** `schema.ts` MUST 包含生产行为依赖的唯一约束、索引、字段 nullability、布尔字段模式和枚举/状态字段类型

#### Scenario: 新增数据库字段

- **WHEN** 需求新增持久化字段或表
- **THEN** 实现 MUST 先更新 `schema.ts`
- **AND** 实现 MUST 通过 drizzle-kit 生成或更新 migration
- **AND** 实现 MUST 更新对应服务层、API/schema 类型和测试

### Requirement: drizzle-kit 维护迁移历史

系统 SHALL 使用仓库根目录 `drizzle.config.ts` 配置 drizzle-kit，并区分 beta 阶段 push 流程和正式版 migration 流程。

#### Scenario: beta 阶段使用 push 同步 schema

- **WHEN** Renarr 在正式发布前维护数据库 schema
- **THEN** `src/lib/server/db/schema.ts` MUST 作为代码中的数据库结构源
- **AND** `db:push` MUST 通过 drizzle-kit 将当前 schema 直接同步到配置的 SQLite 数据库
- **AND** 系统 MUST NOT 要求 beta 阶段维护已提交的 migration history

#### Scenario: package scripts 暴露 DB 命令

- **WHEN** 开发者需要生成或应用数据库迁移
- **THEN** `package.json` MUST 提供 `db:push` 命令用于 beta 阶段同步 SQLite schema
- **AND** `package.json` MUST 预留 `db:generate` 命令用于正式版生成 drizzle-kit migration
- **AND** `package.json` MUST 预留 `db:migrate` 命令用于正式版应用 drizzle-kit migration

#### Scenario: 正式版 migration artifacts 纳入版本管理

- **WHEN** 正式版使用 `db:generate` 生成 `drizzle/` migration 文件
- **THEN** 生成的 SQL、snapshot 或 drizzle-kit 所需 metadata MUST 纳入 git 管理
- **AND** 正式版运行时或发布流程 MUST 使用这些已提交 artifacts 初始化或升级数据库

#### Scenario: beta 阶段重新生成 migration

- **WHEN** 正式发布版本前临时生成过 migration 且需要重新生成
- **THEN** 开发者 MUST 先删除旧的 `drizzle/` 迁移文件
- **AND** 开发者 MUST 再运行 `db:generate` 生成当前目标 schema 的新 migration

#### Scenario: beta 新库初始化

- **WHEN** 应用在空 SQLite 数据库上首次启动
- **THEN** 开发者 MUST 能通过 `db:push` 创建与 `schema.ts` 对齐的当前 schema
- **AND** 应用启动 MUST NOT 依赖旧的手写 `migrate(db)` 建表逻辑

#### Scenario: beta 旧库不兼容

- **WHEN** 开发期旧 SQLite 数据库与当前 migration 历史不兼容
- **THEN** 系统 MAY 要求开发者重建该数据库
- **AND** 系统 MUST NOT 为 beta 阶段旧库提供无损升级 baseline

#### Scenario: 废弃 legacy 数据修正

- **WHEN** 切换到 drizzle-kit migration
- **THEN** migration MUST NOT 迁入 beta 期间废弃的 legacy 数据修正逻辑
- **AND** 当前旧库构造或旧库迁移边界测试 MUST 删除

### Requirement: 生产服务层使用 Drizzle API

系统 SHALL 让生产服务层通过 Drizzle client 和 Drizzle query builder 访问 SQLite。

#### Scenario: 服务读取或写入数据库

- **WHEN** `$lib/server/services` 或 route server 代码需要访问数据库
- **THEN** 代码 MUST 使用 `getDb()` 返回的 Drizzle client
- **AND** 代码 MUST NOT 直接使用公共 raw `better-sqlite3` handle、`prepare(...)` 或 `exec(...)`

#### Scenario: DB 模块运行迁移

- **WHEN** DB 模块初始化 SQLite connection
- **THEN** DB 模块 MAY 在内部使用底层 `better-sqlite3` connection 设置 pragmas
- **AND** raw connection MUST NOT 作为生产服务层公共 API 暴露

#### Scenario: 未来正式兼容阶段构造旧库测试

- **WHEN** 正式兼容阶段需要构造旧 schema 迁移测试
- **THEN** 测试辅助代码 MAY 使用 raw SQL 构造旧数据库形态
- **AND** 该例外 MUST NOT 扩展到生产服务层

### Requirement: DB 改造保持业务行为不变

系统 SHALL 在 DB API 和 migration 改造期间保持现有媒体库业务行为不变。

#### Scenario: 查询实现替换为 Drizzle

- **WHEN** 服务层手写 SQL 查询被替换为 Drizzle builder
- **THEN** 对外 DTO、排序、筛选、状态流转和错误 code MUST 保持与改造前一致
- **AND** 改造 MUST NOT 夹带扫描、识别、rename plan 或 worker 执行规则变更

#### Scenario: 验证改造结果

- **WHEN** DB 改造完成
- **THEN** 项目 MUST 通过 `pnpm run check`
- **AND** 项目 MUST 通过 `pnpm test`
- **AND** 项目 MUST 通过 `pnpm build`
- **AND** 项目 MUST 通过 `pnpm run build:worker`

### Requirement: DB 文档和 agent skill 与代码对齐

系统 SHALL 在 DB 改造完成后同步更新项目文档、agent 指令和 DB 相关 skills。

#### Scenario: 实现完成

- **WHEN** 代码已切换到 drizzle-kit migration 和 Drizzle API 查询
- **THEN** `AGENTS.md`、`README.md` 和相关 ADR MUST 描述当前 beta 兼容策略、迁移目录、Drizzle schema 来源和 DB public boundary
- **AND** `.agents/skills/db-migrations/SKILL.md` MUST 描述 beta `drizzle-kit push` 工作流和正式版 `generate`/`migrate` 工作流，而不是手写 `migrate(db)` 作为当前路径
- **AND** `.agents/skills/drizzle/SKILL.md` MUST 描述生产服务层使用 Drizzle API 和 raw SQL 例外边界

#### Scenario: 准备正式发布

- **WHEN** 用户准备创建正式 release tag 或声明正式发布版本
- **THEN** agent MUST 提醒用户修改 beta 状态描述
- **AND** agent MUST 提醒用户重新确认数据库/API 兼容策略
