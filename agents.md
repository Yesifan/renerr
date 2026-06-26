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

- 前端如果提供可操作开关，必须有真实后端 API 持久化，不要只改本地状态。
- `publicSettings()` 会 mask TMDB API Key。保存设置时不要把 masked key 写回真实配置；设置保存应支持局部更新，并保留未提交的敏感字段。
- 新增设置项时优先更新 schema、服务层和 API，一次保持类型闭环。
- WebDAV source 的 URL 必须以用户填写值为准，不要自动拆成服务端根地址加 remote base path。
- AList WebDAV 跨目录重命名需要兼容“先移动到目标目录原文件名，再重命名为目标文件名”的两步语义；整理执行器需要能从 intermediate path 恢复。
- 统一通过 `execute_rename_plan` 执行自动/手动整理，自动和手动只作为 rename plan 的来源与确认方式区分。
- 整理成功后必须同步更新 `library_items` 的 `video_file_count`、`compliant_file_count`、`non_compliant_file_count`，不能依赖下一次扫描刷新列表摘要。
- `failed` item 允许手动扫描、手动 TMDB 指定、生成整理计划；`pending_review` 必须先手动指定后再整理。
- folder/item detail 需要实时读取 WebDAV，扫描缓存只用于列表摘要。

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
- WebDAV library setup 浏览器只显示目录；item detail 显示目录中的视频、sidecar、metadata 等文件。
- TV/Movie library detail 都只展示顶级目录中的视频文件和文件夹；TV 海报墙按一级剧集文件夹展示。
- 数据库记录一级 `library_items` 的身份、状态和统计；不长期保存内部视频文件表。
- `organized` 表示一级文件夹已匹配 identity，不要求内部文件全部符合当前命名模板；通过 non-compliant count 提示“有待整理文件”。
- 对 item 的手动整理入口覆盖 organized 内部不合规文件，不需要额外提供 organized 专用整理入口。
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
