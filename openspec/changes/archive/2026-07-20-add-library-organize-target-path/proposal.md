## Why

Renarr 目前默认把 Library Path 同时作为扫描根目录和整理目标根目录，无法支持“原始下载目录作为待整理入口、整理后归档到同一 source 下另一个目录”的工作流。用户需要把 `source/library/a/01.mp4` 整理到 `source/target_path/show/season01/a.s01e01.mp4`，并且整理后原 item 从入口目录消失是预期行为。

## What Changes

- Library Path 新增可选的整理目标目录配置；默认继续整理到当前 Library Path。
- 添加 Library Path 时可以选择是否整理到其他目录，并填写同一 WebDAV source 下的目标目录。
- Settings 中支持编辑已有 Library Path 的整理目标目录。
- 目标目录必须可读测试，并且 target path 不能是当前 library path 的子目录。
- Rename plan 生成 target path 时使用整理目标目录作为根目录；执行仍沿用当前 row-by-row move 和 overwrite 策略。
- 整理成功后，原 item 从原 Library Path 扫描结果中消失并被硬删除，符合 inbox/staging 语义；如需继续管理归档目录，用户应另行添加归档目录为 Library Path。
- 新增和修改的前端用户可见文案必须使用 Paraglide i18n messages，不在 Svelte 组件中新增硬编码中文文案。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `scan-and-organize`: Library Path 整理计划可使用独立目标目录生成 target path，并保留原 item 消失即硬删除的扫描语义。
- `connectivity-testing`: WebDAV path 测试扩展为支持 Library Path 的整理目标目录测试。
- `database-persistence`: Library Path 新增持久化字段以保存整理目标目录配置。
- `i18n-localization`: Library Path 目标目录相关 UI 文案和错误提示必须纳入 Paraglide messages。

## Impact

- Database schema: `library_paths` 需要新增整理目标目录相关字段，并保持 beta 阶段以 `db:push` 同步。
- API/schema: Library Path create/update DTO、服务层和返回类型需要包含目标目录配置。
- Planner/executor: planner 使用目标根目录生成 `targetFilePath`；executor overwrite 和跨目录 move 策略不变。
- Scanner: 保持原 Library Path 作为扫描入口；整理到目标目录后原 item 消失仍按现有规则硬删除。
- Settings UI: 添加和编辑 Library Path 时展示目标目录开关、目标目录输入、候选浏览和目标目录测试。
- i18n: 更新 `messages/zh-CN.json` 和生成的 Paraglide message 使用点，确保新增/修改 UI 文案走 `$lib/i18n`。
- Tests: 覆盖目标目录校验、计划生成、执行后扫描语义和 UI/API 类型闭环。
