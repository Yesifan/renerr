# Code Conventions

## SPEC

默认优先使用中文进行文档的编写。

## UX 与信息架构

- 有限使用 shadcn 组件进行构建，如果没有对应组件则使用 shadcn cli 添加。
- 当 UI 交互复杂且 shadcn-svelte 没有可用组件或无法表达业务语义时，应构建项目级自定义 UI 组件；优先复用 Bits UI primitive 和 shadcn/Tailwind 语义 token。
- "添加"类操作不要常驻为内容 card；使用模态框承载添加表单。
- "修改"类操作保留在原位置内联编辑，并提供明确的保存按钮。
- 列表里的二值设置优先用开关，不用纯文本"开启/关闭"代替可操作控件。
- 不要把同一个管理对象放到多个同级页面重复维护；需要保留旧 URL 时使用重定向。

## Svelte

- 使用 Svelte 5 runes 风格：`$state`、`$derived`、`$props`，事件使用 `onclick`/`onchange`。
- 列表必须使用 keyed each blocks。
- 表单输入使用 `bind:value` / `bind:checked`；需要立即持久化的控件用事件调用 API。
- 优先用主题变量、页面级 class 或项目组件封装，不为局部需求修改 shadcn 基础组件。

## Verification

完成功能后至少运行：

```sh
pnpm run lint
# 如果有 lint 问题可以先尝试运行 `pnpm run format` 修复
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

## I18n

使用 `@inlang/paraglide-js` 进行 i18n，V1 只配置 `zh-CN`；UI 语言是浏览器偏好，不写入 SQLite。

对于使用前端 UI 文案默认使用 `@inlang/paraglide-js` 支持 i18n；后端、worker、日志 message 使用英文原文。

### 翻译文件

- zh: `messages/zh-CN.json`

### 使用方法

```ts
import { messages as m } from '$lib/i18n';

m.toast_test_succeeded();
```

## MCP / Svelte MCP Tools

参考 Svelte 项目中 `.agents/skills/svelte-code-writer/SKILL.md` 中的描述：

1. `list-sections` — 发现所有可用的文档章节。
2. `get-documentation` — 获取特定章节的完整文档内容。
3. `svelte-autofixer` — 分析 Svelte 代码并返回问题和建议。
4. `playground-link` — 生成 Svelte Playground 链接（需要用户确认后使用）。
