# Renarr

Renarr 是深色管理台风格应用

## SPEC

默认优先使用中文进行文档的编写

## UX 与信息架构

- 有限使用 shadcn 组件进行构建，如果没有对应组件则使用 shadcn cli 添加
- 构建 UX 交互良好的影视库管理界面
- “添加”类操作不要常驻为内容 card；使用模态框承载添加表单。
- “修改”类操作保留在原位置内联编辑，并提供明确的保存按钮。
- 列表里的二值设置优先用开关，不用纯文本“开启/关闭”代替可操作控件。
- 不要把同一个管理对象放到多个同级页面重复维护；需要保留旧 URL 时使用重定向。

## Backend/API Notes

- 当前项目标记为开发中的 beta 版本；在正式发布版本前，不要求数据库或 API 无损升级/向后兼容，必要时可以直接重建本地 SQLite 数据库。
- 如果用户准备发布正式版本，例如创建正式 release tag，必须提醒用户先修改 beta 状态说明，并重新确认数据库/API 兼容策略。
- DB 访问目标是业务服务层统一使用 Drizzle API；`getSqlite()`/raw better-sqlite3 handle 不作为生产服务层公共 API 暴露，只允许 Drizzle migrator 和少量测试辅助工具使用。
- Drizzle schema 是数据库结构的唯一真实来源；所有 SQLite 表、索引和约束都必须在 `src/lib/server/db/schema.ts` 表达，并由 drizzle-kit 迁移生成/维护。
- drizzle-kit 配置使用仓库根目录 `drizzle.config.ts`，迁移输出使用根目录 `drizzle/`，不放入 `src` 或 `docs`。
- 切换到 drizzle-kit 迁移后，不迁移 beta 期间废弃的 legacy 数据修正逻辑；旧开发库不兼容时直接重建。
- DB/迁移改造按两层实施：先完成 schema、drizzle.config、初始 migration、启动 migrator 和 raw handle 边界；再逐个服务把查询改成 Drizzle API，期间不夹带业务规则变更。
- DB raw SQL 边界通过 agent 约定和 code review 维护，不新增自动化检查脚本。
- 当前 beta 阶段不保留旧库构造/迁移边界测试；已有 legacy 迁移测试可删除。未来正式兼容阶段如果需要构造旧 schema 测试，允许在测试辅助代码中使用 raw SQL。
- 前端如果提供可操作开关，必须有真实后端 API 持久化，不要只改本地状态。
- `publicSettings()` 会 mask TMDB API Key。保存设置时不要把 masked key 写回真实配置；设置保存应支持局部更新，并保留未提交的敏感字段。
- 新增设置项时优先更新 schema、服务层和 API，一次保持类型闭环。
- WebDAV source 的 URL 必须以用户填写值为准，不要自动拆成服务端根地址加 remote base path。
- AList WebDAV 跨目录重命名需要兼容“先移动到目标目录原文件名，再重命名为目标文件名”的两步语义；整理执行器需要能从 intermediate path 恢复。
- 统一通过 `execute_rename_plan` 执行自动/手动整理，自动和手动只作为 rename plan 的来源与确认方式区分。
- 整理成功后必须同步更新 `library_items` 的 `video_file_count`、`compliant_file_count`、`non_compliant_file_count`，不能依赖下一次扫描刷新列表摘要。
- 不再使用 item status `failed` 表示重命名失败；执行失败只展示在任务、日志、execution records 和 summary 中。
- 旧 `failed` item 读取或迁移时按是否已有 identity 兼容为 `identified` 或 `pending_review`。
- `pending_review` 必须先手动指定 TMDB identity；手动指定成功后直接进入 rename plan draft 编辑流程。
- `identified` item 可手动指定或执行计划；`organized` item 只有存在 non-compliant 文件时显示执行计划，不显示手动指定。
- item detail 不展示实时文件列表；创建 rename plan draft 时才实时读取 WebDAV 文件。

## V1 核心实现文件

- WebDAV 客户端：`src/lib/server/integrations/webdav-client.ts`
- 扫描与 item 统计：`src/lib/server/services/scanner.ts`
- 整理计划生成：`src/lib/server/services/planner.ts`
- 整理计划执行：`src/lib/server/services/executor.ts`
- 文件名解析：`src/lib/server/services/parser.ts`
- 文件合规判断：`src/lib/server/services/compliance.ts`
- 媒体库 item/detail 服务：`src/lib/server/services/items.ts`
- WebDAV/TMDB/source/settings 服务：`src/lib/server/services/sources.ts`、`src/lib/server/services/tmdb.ts`、`src/lib/server/services/settings.ts`
- Worker 入口：`src/worker/index.ts`
- 媒体库主界面：`src/routes/libraries/[id]/+page.svelte`
- V1 回归测试：`src/lib/server/services/v1-core-flows.test.ts`、`src/lib/server/integrations/webdav-client.test.ts`

## V1 产品决策

- 单仓单 SvelteKit app，保留 worker 独立入口，由 web 主进程负责 worker 生命周期。
- 前端使用 Svelte 5、TypeScript、Tailwind CSS、shadcn-svelte、Svelte Query、Paraglide。
- i18n 使用 `@inlang/paraglide-js`，V1 只配置 `zh-CN`；UI 语言是浏览器偏好，不写入 SQLite。
- 后端、worker、日志 message 使用英文原文；普通 UI 错误通过 error code 翻译成中文。
- 默认深色媒体管理工具风格，无主题切换入口；状态色保持克制。
- 左侧使用多级树状导航：媒体库 path、系统任务、日志、设置。
- WebDAV library setup 浏览器只显示目录；item detail 展示媒体身份、海报、完整远端路径和扫描统计，不展示实时文件列表。
- TV/Movie library detail 都只展示顶级目录中的视频文件和文件夹；TV 海报墙按一级剧集文件夹展示。
- 数据库记录一级 `library_items` 的身份、状态和统计；不长期保存内部视频文件表。
- `organized` 表示一级文件夹已匹配 identity，不要求内部文件全部符合当前命名模板；通过 non-compliant count 提示“有待整理文件”。
- `organized` 内部不合规文件通过执行计划入口整理，不提供 organized 手动指定入口。
- 顶级单文件整理后视为原 file item 删除、新 folder item 新建，不做 file -> folder 身份转换。
- 扫描以远端一级目录为事实来源，同步 `library_items`，消失的 item 硬删除。
- TMDB 请求需要支持环境变量代理。
- 后台任务类型保持：`scan_library_path`、`scan_library_item`、`execute_rename_plan`、`cleanup_invalid_dirs`。

# Svelte

- 使用 Svelte 5 runes 风格：`$state`、`$derived`、`$props`，事件使用 `onclick`/`onchange`。
- 列表必须使用 keyed each blocks。
- 表单输入使用 `bind:value` / `bind:checked`；需要立即持久化的控件用事件调用 API。
- 不直接改 shadcn 基础组件来做局部视觉需求；优先用主题变量、页面级 class 或项目组件封装。

## Verification

完成功能后至少运行：

```sh
pnpm run check
pnpm test
pnpm build
pnpm run build:worker
```

## shadcn

直接运行 `pnpm dlx shadcn-svelte@latest add` 可能会遇到网络问题，可以使用下面的命令绕过代理安装 shadcn 组件。

```sh
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy pnpm dlx shadcn-svelte@latest add card
```

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
