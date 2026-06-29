## Why

当前 `libraries/[id]` 同时承担媒体库 item 海报墙、item detail、手动识别、扫描和整理计划操作，导致页面状态耦合、海报 card 交互过重，也让用户难以区分“浏览库内容”和“处理单个 item”的任务边界。

现在需要将 item detail 提取到独立路由，让媒体库列表页保持扫描和浏览职责，详情页集中承载核对、识别、扫描和整理等高风险操作。

## What Changes

- 将 `libraries/[id]` 调整为媒体库 item 列表页，只展示 library path 摘要、扫描入口和 item 海报墙。
- 新增 `libraries/[id]/[item_id]` item detail 页面，承载远端文件详情、手动 TMDB 指定、单 item 扫描、整理计划生成/编辑/提交等操作。
- 简化海报 card：只展示海报、标题、年份、状态和文件统计摘要，不在 card 内嵌手动匹配表单或整理操作按钮。
- 将 card 点击行为改为进入 item detail 路由，而不是在同页展开右侧详情面板。
- 保留媒体库列表的轮询刷新能力；将 item detail、manual match 和 rename plan 的 query/mutation 状态移动到详情页。
- 旧的同页 detail 面板实现应删除或改为详情页组件，避免同一对象在两个同级区域重复维护。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-shell-and-theme`: 明确媒体库列表页与 item detail 页的信息架构、海报 card 展示职责和操作聚合位置。
- `sveltekit-data-boundaries`: 明确列表页和详情页的数据边界，列表页使用首屏摘要数据，详情页负责 item 级高交互 API 和 Svelte Query 状态。

## Impact

- Affected routes:
  - `src/routes/libraries/[id]/+page.svelte`
  - `src/routes/libraries/[id]/+page.server.ts`
  - new `src/routes/libraries/[id]/[item_id]/+page.svelte`
  - new `src/routes/libraries/[id]/[item_id]/+page.server.ts`
- Affected components:
  - `LibraryItemGrid.svelte`
  - `LibraryItemCard.svelte`
  - `ItemDetailPanel.svelte`
  - `ManualMatchPanel.svelte`
  - `RenamePlanPanel.svelte`
- Affected client state:
  - Svelte Query keys for item lists, item detail, and rename plan drafts
  - selected item state should be removed from the list page
- No new external dependencies are expected.
