# Renarr

Renarr 是深色管理台风格应用

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
