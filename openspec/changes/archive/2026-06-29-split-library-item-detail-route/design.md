## Context

`src/routes/libraries/[id]/+page.svelte` 当前同时持有媒体库列表、选中 item、item detail 查询、手动 TMDB 搜索、指定 identity、单 item 扫描、rename plan draft 和提交整理计划等状态。`LibraryItemCard.svelte` 还内嵌了 `ManualMatchPanel`，让海报 card 同时承担展示、选择和操作表单职责。

这与 Renarr 的信息架构目标冲突：媒体库列表应帮助用户快速扫描一级文件夹和文件摘要；单个 item 的核对、识别和整理属于更深一层的工作台页面。

## Goals / Non-Goals

**Goals:**

- 将 `libraries/[id]` 收敛为列表页，保留 library path 标题、刷新/扫描入口和 item 海报墙。
- 新增 `libraries/[id]/[item_id]` detail 页面，集中承载 item detail、手动匹配、扫描、rename plan draft 和提交操作。
- 简化 `LibraryItemCard`：只展示海报、标题、年份、状态、视频数和待整理摘要，并导航到 detail 页面。
- 让 Svelte Query 状态按页面职责归属：列表页只管理列表轮询，详情页管理 item detail 和 item 级 mutations。
- 继续使用 shadcn-svelte Card/Button/Table/Badge/Skeleton/Empty 等组件，保持页面和业务组件的 class 简单。

**Non-Goals:**

- 不重做 WebDAV、TMDB、scanner、planner 或 executor 后端逻辑。
- 不新增播放、推荐、筛选或批量整理能力。
- 不改变现有 API 的业务语义，除非实现中发现 route 参数校验必须补齐。
- 不引入新的 UI 组件库或外部依赖。

## Decisions

### Decision: 使用嵌套路由承载 item detail

实现 `src/routes/libraries/[id]/[item_id]/+page.svelte` 和 `+page.server.ts`，路径中的 `id` 继续表示 library path，`item_id` 表示 library item。

Rationale: item detail 是独立任务上下文，用户需要完整宽度核对远端文件、候选身份和 rename plan。嵌套路由保持 URL 可分享、可刷新，并自然表达 item 属于某个 library path。

Alternative considered: 在 `libraries/[id]` 继续使用右侧 aside detail。这个方式减少路由文件，但保留了列表和操作状态耦合，也让海报墙在宽屏和窄屏上都被 detail 面板挤压。

### Decision: 列表页 card 只负责摘要和导航

`LibraryItemCard` 不再接收 manual match、search results、choose identity 或 selected 状态。它应接收 `item` 和目标 `href`，用卡片整体链接进入详情页。

Rationale: card 是扫描和识别入口，不是工作台。操作按钮和表单放进 card 会破坏海报墙的扫描效率，也会让每个 card 的高度不可预测。

Alternative considered: 在 card 内保留一个“处理”按钮。该按钮仍会让 card 变成操作容器，并在移动端造成重复焦点；整卡导航更简单。

### Decision: 详情页持有 item 级高交互状态

详情页负责：

- item detail 查询：`/api/library-items/[item_id]`
- 单 item 扫描：`/api/library-items/[item_id]/scan`
- TMDB 搜索：`/api/library-items/[item_id]/recognition/search`
- 指定 identity：`/api/library-items/[item_id]/recognize`
- rename plan draft 创建、更新、提交

列表页只负责：

- library path 首屏数据
- item 列表轮询
- library path 扫描任务

Rationale: 这让 mutation invalidation 更明确，减少 list page 的局部状态，并与 `sveltekit-data-boundaries` 的职责专一 API 原则一致。

Alternative considered: 把 detail 所有数据放进 `+page.server.ts` 一次性读取。远端文件详情需要实时读取 WebDAV，rename plan draft 和手动匹配又是高交互流程，完全 server load 会降低局部刷新效率。

### Decision: 复用现有 detail 组件但调整 props

`ItemDetailPanel`、`ManualMatchPanel`、`RenamePlanPanel` 可以继续作为详情页内部业务区块，但它们不应依赖“selected item”概念。详情页应直接把当前 item 作为上下文传入。

Rationale: 保留已拆出的业务组件，避免一次重构引入新视觉系统；只改变页面职责和组件边界。

Alternative considered: 将 detail 页面全部写在一个 Svelte 文件中。短期更直接，但会再次形成复杂页面，不利于后续维护。

## Risks / Trade-offs

- [Risk] 新路由需要从 URL 直接打开时可靠获取 library 和 item 上下文 → Mitigation: `+page.server.ts` 读取 library 和 item 初始数据；找不到 item 时返回 404 或可恢复错误。
- [Risk] 从列表进入详情后返回列表可能丢失滚动位置 → Mitigation: 使用普通浏览器历史返回，列表页保留稳定 grid 和 query key；后续如有需要再增加 scroll restoration。
- [Risk] 移动组件时 query invalidation 漏掉列表刷新 → Mitigation: 详情页 mutation 成功后 invalidate `libraryItems(id)`、`itemDetail(item_id)`、`libraries` 和 `tasks`。
- [Risk] 海报 card 简化后用户不知道在哪里操作 → Mitigation: card 保留明确状态和待整理摘要；详情页 header 提供“扫描”“生成整理计划”等集中操作。
