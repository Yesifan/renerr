# Backend / API Conventions

## Beta 状态

当前项目标记为开发中的 beta 版本；在正式发布版本前，不要求数据库或 API 无损升级/向后兼容，必要时可以直接重建本地 SQLite 数据库。

如果用户准备发布正式版本，例如创建正式 release tag，必须提醒用户先修改 beta 状态说明，并重新确认数据库/API 兼容策略。

## 数据库

DB 访问目标是业务服务层统一使用 Drizzle API；`getSqlite()`/raw better-sqlite3 handle 不作为生产服务层公共 API 暴露，只允许必要 DB 初始化、正式版迁移工具和少量测试辅助工具使用。

Drizzle schema 是数据库结构的唯一真实来源；所有 SQLite 表、索引和约束都必须在 `src/lib/server/db/schema.ts` 表达，并由 drizzle-kit 迁移生成/维护。

### 迁移策略

- Beta 阶段直接使用 `drizzle-kit push` 同步本地 SQLite schema。
- 正式版再使用 `drizzle-kit generate`/`migrate` 和已提交 migration artifacts。
- drizzle-kit 配置使用仓库根目录 `drizzle.config.ts`；正式版 migration 输出使用根目录 `drizzle/`，不放入 `src` 或 `docs`。
- `package.json` 必须提供 `db:push`、`db:generate` 和 `db:migrate` 命令；beta 阶段以 `db:push` 为主，正式版 `db:generate` 生成的 `drizzle/` migration artifacts 必须纳入 git 管理。
- 正式发布版本前如果临时生成过 migration，每次重新生成前先删除旧的 `drizzle/` 迁移文件，再生成当前目标 schema 的新 migration。
- 切换到 drizzle-kit 迁移后，不迁移 beta 期间废弃的 legacy 数据修正逻辑；旧开发库不兼容时直接重建。
- DB/迁移改造按两层实施：先完成 schema、drizzle.config、beta `db:push`、正式版 `db:generate`/`db:migrate`、移除手写建表迁移和 raw handle 边界；再逐个服务把查询改成 Drizzle API，期间不夹带业务规则变更。
- DB raw SQL 边界通过 agent 约定和 code review 维护，不新增自动化检查脚本。
- 当前 beta 阶段不保留旧库构造/迁移边界测试；已有 legacy 迁移测试可删除。未来正式兼容阶段如果需要构造旧 schema 测试，允许在测试辅助代码中使用 raw SQL。

## API 约定

- 前端如果提供可操作开关，必须有真实后端 API 持久化，不要只改本地状态。
- `publicSettings()` 会 mask TMDB API Key。保存设置时不要把 masked key 写回真实配置；设置保存应支持局部更新，并保留未提交的敏感字段。
- 新增设置项时优先更新 schema、服务层和 API，一次保持类型闭环。
- WebDAV source 的 URL 必须以用户填写值为准，不要自动拆成服务端根地址加 remote base path。

## 整理执行规则

- AList WebDAV 跨目录重命名需要兼容"先移动到目标目录原文件名，再重命名为目标文件名"的两步语义；整理执行器需要能从 intermediate path 恢复。
- 统一通过 `execute_rename_plan` 执行自动/手动整理，自动和手动只作为 rename plan 的来源与确认方式区分。
- 整理执行器不得直接更新 `library_items` 的 identity 或 `video_file_count`、`compliant_file_count`、`non_compliant_file_count`；执行结束后由后置 `scan_library_path` 根据远端事实刷新。
- 不再使用 item status `failed` 表示重命名失败；执行失败只展示在任务、`task_detail_lines` 和 task summary 中。
- beta 阶段不再兼容旧 `failed` item；遇到旧开发库不匹配时重建数据库。

## Item 状态与操作规则

- `pending_review` 必须先手动指定 TMDB identity；手动指定成功后直接进入 rename plan draft 编辑流程。
- `identified` item 可手动指定或执行计划；`organized` item 不显示手动指定，当前 UI 在存在视频文件时提供执行计划入口，planner 再通过完整 source/target path 比较过滤 no-op rows。
- item detail 不展示实时文件列表；创建 rename plan draft 时才实时读取 WebDAV 文件。
