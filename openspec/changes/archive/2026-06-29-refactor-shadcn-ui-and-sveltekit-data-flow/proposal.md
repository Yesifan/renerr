## Why

当前 UI 已经部分使用 shadcn-svelte，但 shell、modal、section panel、select、switch、table、form control 等仍混用自写组件和原生控件，导致视觉、可访问性和交互约定不一致。同时页面数据大量通过 `/api/workspace` 和客户端 fetch 获取，和 SvelteKit 全栈项目的 `load`、actions、窄 API 边界不匹配。

本变更用于分阶段统一 Renarr 的 shadcn UI 基础，并收敛前后端数据边界，让页面首屏、页面表单、高交互 API 和 server services 各自职责清晰。

## What Changes

- 补齐缺失的 shadcn-svelte 组件，并优先用 shadcn 组件替换可表达的 UI：Dialog、Select、Switch、Checkbox、Input、Field、Table、Badge、Empty、Skeleton、Sidebar 等。
- 保留 `SectionPanel` 作为项目级业务封装，但底层改用 shadcn Card 组合；删除通用 `Modal`，页面直接组合 shadcn Dialog 或后续抽业务级 dialog。
- 替换所有原生 `select`，包括顶部语言选择；二值控件按语义使用 Switch 或 Checkbox。
- 按业务区域拆分复杂页面组件，降低 `settings/media`、`libraries/[id]` 和 AppShell 的单文件复杂度。
- 拆分 `/api/workspace` 的职责，避免长期使用巨型聚合 DTO；页面首屏数据改由对应 server load 直接调用 server services。
- 设置页保存/添加类操作迁移到 SvelteKit actions；测试连接、WebDAV browse、媒体库详情页高交互流程继续使用职责专一的 JSON API。
- 保留 TanStack Svelte Query，但限定在轮询、懒加载详情、TMDB 搜索、rename draft 行内更新等高交互场景。
- 拆分 `src/lib/client/api.ts` 中的 DTO、UI formatter 和 fetch helper 职责，并为新增/改动的写接口和 query 参数引入 Zod schema 校验。

## Capabilities

### New Capabilities

- `sveltekit-data-boundaries`: 定义 Renarr 页面首屏数据、页面表单 actions、职责专一 JSON API、Svelte Query 和 server services 的边界。

### Modified Capabilities

- `ui-shell-and-theme`: 更新 UI shell、导航、表单、dialog、select、switch、table、status badge 和空状态必须优先使用 shadcn-svelte 组件的要求。

## Impact

- 影响 `src/lib/components/AppShell.svelte`、`SectionPanel.svelte`、`Modal.svelte` 和 `src/lib/components/ui/**`。
- 影响首页、设置页、媒体库详情页、系统任务/日志页及相关页面级组件拆分。
- 影响 `/api/workspace`、settings/sources/libraries/library-items/tasks/logs/navigation 等读取和写入边界。
- 影响 `src/lib/client/api.ts`、query keys、共享 schema/type 模块和 UI formatter 位置。
- 需要新增或调整 `+layout.server.ts`、部分 `+page.server.ts`、settings actions、窄 API routes 和 Zod 输入 schema。
- 验证至少包含 `pnpm run check`、`pnpm test`、`pnpm build`、`pnpm run build:worker`，并对主要 shadcn Dialog/Select/Switch 交互做浏览器 smoke test。
