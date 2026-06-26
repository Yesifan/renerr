## 1. i18n 基础设施

- [x] 1.1 安装并配置 `@inlang/paraglide-js`，生成 `zh-CN` messages 入口
- [x] 1.2 增加语言偏好读取/保存逻辑，使用浏览器偏好而不是 SQLite settings
- [x] 1.3 将应用 shell、导航、状态标签、按钮和常用提示迁移到 Paraglide message 函数
- [x] 1.4 增加前端 error code 到中文 message 的映射，并保留未知错误 fallback
- [x] 1.5 确认日志页继续显示后端英文原文和 `contextJson`，不走 message 翻译

## 2. API 错误与连通性测试

- [x] 2.1 统一 API error DTO，包含稳定 `code`、安全 `message` 和可选 `context`
- [x] 2.2 加固 WebDAV test service，确保只做认证/list 测试且不执行写操作
- [x] 2.3 增加 WebDAV source/path 测试 UI，支持新输入凭据和已保存凭据
- [x] 2.4 确保 library setup 的 WebDAV 浏览只显示目录并逐级读取，不展示文件或递归加载整棵树
- [x] 2.5 增加 TMDB connectivity test service，支持当前输入 key 或已保存 key
- [x] 2.6 增加 TMDB 测试 UI，并确保完整 API key 不回显、不写日志
- [x] 2.7 为 WebDAV/TMDB 测试成功、失败和 secret 脱敏补充测试

## 3. 扫描状态机

- [x] 3.1 修复 `scan_library_path`，确保 root-level `library_items` 以远端一级条目为事实来源同步
- [x] 3.2 实现 `unidentified` 扫描识别规则：high-confidence 转 `identified`，其它已处理结果转 `pending_review`
- [x] 3.3 确保 `pending_review` 和 `failed` 在扫描中跳过识别、内部检查和自动整理
- [x] 3.4 确保 `identified` 扫描不再查询 TMDB，也不自动变更 identity
- [x] 3.5 修复 `organized` 扫描，只刷新视频数量和模板符合度统计，不重新 TMDB 识别
- [x] 3.6 增加 `scan_library_item` task/API，仅允许 `organized` 和 `unidentified` 状态
- [x] 3.7 为各状态扫描流转和不允许状态的 error code 补充测试

## 4. Plan Draft 与手动复核

- [x] 4.1 增加 `rename_plan_drafts` schema/migration 或等效持久化结构
- [x] 4.2 实现 item detail 实时读取 WebDAV 文件列表，并合并最近 scan/plan/execution 摘要
- [x] 4.3 实现从 `identified`/`organized` item 的实时 WebDAV 文件生成 plan draft
- [x] 4.4 在 plan draft rows 中包含 source、target preview、media mapping、selected、conflict、sidecar preview
- [x] 4.5 实现 draft row 勾选/取消、TV season/episode 调整和 target preview 重新计算
- [x] 4.6 禁止用户直接编辑 target path 字符串
- [x] 4.7 实现 draft 提交校验，缺少必要 mapping 或未处理冲突时拒绝提交
- [x] 4.8 实现 force overwrite 的 row 选择和二次确认流程
- [x] 4.9 提交 draft 时创建 confirmed `rename_plan(mode='manual')`，且只包含 selected rows
- [x] 4.10 为 item detail 实时 DTO、draft 生成、row 调整、校验失败和提交成功补充测试

## 5. 手动 TMDB 搜索与 Identity 指定

- [x] 5.1 加固 TMDB 搜索 API，校验输入并返回前端需要的 movie/tv DTO
- [x] 5.2 在所有 `pending_review` item UI 中提供系统候选和手动搜索入口
- [x] 5.3 支持 no-match/parse-failed 且无候选的 item 手动搜索 TMDB
- [x] 5.4 实现选择 TMDB result 后保存 source identity 字段并转为 `identified`
- [x] 5.5 确保用户指定 identity 后可只保存，不强制立即整理
- [x] 5.6 为候选展示、手动搜索、identity 保存和状态转换补充测试

## 6. Rename Plan 执行器

- [x] 6.1 统一自动和手动整理为 `execute_rename_plan` task，使用 `rename_plans.mode` 区分来源
- [x] 6.2 执行每个 plan item 前重新校验 source 存在、target file 冲突和 overwrite 设置
- [x] 6.3 确保已存在 target folder 被复用，只有 target file 存在才算冲突
- [x] 6.4 自动 plan 永不 overwrite，手动 overwrite 必须来自已确认 plan
- [x] 6.5 执行时重新发现实际存在的 sidecar，并记录 sidecar 成功/失败详情
- [x] 6.6 metadata 写入按目标顶级 folder 去重，失败不回滚 MOVE
- [x] 6.7 单个 plan item 失败后继续执行剩余 items，并正确返回 `succeeded`/`partially_failed`/`failed`
- [x] 6.8 执行后正确更新或删除 `library_items` 当前状态，并写入文件级 execution records
- [x] 6.9 为 source 消失、target 冲突、overwrite、sidecar 失败、metadata 失败和部分失败补充测试

## 7. 前端流程整合

- [x] 7.1 将 library detail 的手写 polling 迁移到 Svelte Query，并使用集中 query keys
- [x] 7.2 增加 item detail 视图，展示 item 内部文件、统计、执行摘要和可用操作
- [x] 7.3 在 item detail 中提供 `identified`/`organized` 的手动整理入口
- [x] 7.4 增加 plan draft table UI，支持预览、编辑、冲突处理和提交
- [x] 7.5 创建任务后留在当前上下文，显示 localized toast/status，并提供任务页链接
- [x] 7.6 确保 task/log/library item 相关 mutations 成功后 invalidate 对应 query keys
- [x] 7.7 统一默认深色媒体管理工具风：左侧树导航、深灰主内容、海报墙 card、克制状态色和 shadcn 语义 token
- [x] 7.8 检查主要页面移动端和桌面布局，避免文本溢出和控件重叠

## 8. 验证与收尾

- [x] 8.1 运行类型检查和 Svelte check，修复所有新增类型和组件问题
- [x] 8.2 运行 Vitest，确保 scanner/planner/executor/API 测试通过
- [x] 8.3 启动 web 和 worker，本地验证 WebDAV/TMDB 测试、扫描、pending review、plan preview 和执行闭环
- [x] 8.4 更新必要 README 或开发说明，记录 Paraglide、连通性测试和手动 plan 流程
- [x] 8.5 确认所有后端日志为英文，普通前端用户可见错误为中文
