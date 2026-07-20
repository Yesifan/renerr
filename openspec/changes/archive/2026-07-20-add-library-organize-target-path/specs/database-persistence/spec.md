## ADDED Requirements

### Requirement: Library Path 持久化整理目标目录

系统 SHALL 在 Drizzle schema、服务层 DTO、API schema 和前端类型中持久化 Library Path 的可选整理目标目录。Existing Library Paths MUST default to no independent target path and continue using their own path as the organize target root.

#### Scenario: 新增 Library Path 未配置整理目标目录

- **WHEN** 用户创建 Library Path 且未启用整理到其他目录
- **THEN** 系统 MUST 保存该 Library Path 的整理目标目录为空
- **AND** API 返回的 Library DTO MUST 表示未配置独立整理目标目录

#### Scenario: 新增 Library Path 配置整理目标目录

- **WHEN** 用户创建 Library Path 并填写有效整理目标目录
- **THEN** 系统 MUST 保存规范化后的整理目标目录
- **AND** API 返回的 Library DTO MUST 包含该整理目标目录

#### Scenario: 编辑 Library Path 整理目标目录

- **WHEN** 用户更新已有 Library Path 的整理目标目录
- **THEN** 系统 MUST 持久化新整理目标目录并更新 `updated_at`
- **AND** 后续读取 Library Path MUST 返回新配置

#### Scenario: 关闭独立整理目标目录

- **WHEN** 用户关闭已有 Library Path 的独立整理目标目录
- **THEN** 系统 MUST 清空持久化的整理目标目录
- **AND** 后续 rename plan MUST 回退到使用 Library Path path 作为目标根目录

#### Scenario: Beta schema 同步

- **WHEN** 开发者在 beta 阶段应用该数据库字段变更
- **THEN** `src/lib/server/db/schema.ts` MUST 包含该字段
- **AND** 开发者 MUST 能通过 `pnpm run db:push` 将字段同步到本地 SQLite 数据库
