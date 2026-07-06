## Context

Renarr 已经引入 Bits UI 作为 shadcn-svelte 基础 primitive 依赖，并且已经有 Library path 目录候选和 TV season/episode 候选能力。当前实现偏向页面内联状态和普通 input/datalist，缺少可复用 autocomplete primitive，也无法在剧集选择中承载季简介、集简介、播出日期等复杂候选内容。

这次变更聚焦前端交互组件化：保留现有后端 API 和 draft 数据模型，重建输入组件层。

## Goals / Non-Goals

**Goals:**

- 构建可复用 `AsyncCombobox.svelte`，封装异步候选、loading、empty、error、选择、键盘导航和移动端/桌面端布局。
- 构建专用 `EpisodeMappingInput.svelte`，服务 rename plan TV row 的 `season/episode` 输入与 TMDB 候选选择。
- 使用 `AsyncCombobox` 替换 Library path path suggestion UI。
- 使用 `EpisodeMappingInput` 替换 TV row 当前的 season/episode 控件。
- 更新 `AGENTS.md`，明确复杂 UI 且 shadcn-svelte 不覆盖时应构建项目级自定义 UI 组件，可直接使用 Bits UI primitive。

**Non-Goals:**

- 不改变 rename plan draft DTO、confirmed rename plan schema 或 naming template。
- 不把不完整剧集输入写入后端 draft。
- 不把 `EpisodeMappingInput` 抽象成通用 combobox；它是业务专用组件。
- 不新增数据库表或长期缓存 TMDB 剧集数据。
- 不修改 WebDAV source URL 或 Library path 保存语义。

## Decisions

### 1. `AsyncCombobox` 是 typed primitive，不承载业务语义

`AsyncCombobox.svelte` 使用 Bits UI Combobox primitive，暴露 typed option API：

- `loadOptions(query, context)` 或由父级传入已加载 options
- `getKey(option)`
- `getLabel(option)`
- `onSelect(option)`
- optional snippet/custom render for option body

组件内部负责 input value、dropdown open state、loading、empty、error、active item、keyboard/focus 和 mobile/desktop responsive layout。它不理解 WebDAV path、TMDB、season 或 episode。

选择这个分层是为了避免把第一个使用场景写死进基础组件。备选方案是只做字符串 autocomplete；它会让复杂候选渲染、稳定 key 和 typed selection 变脆，因此不采用。

### 2. `EpisodeMappingInput` 是专用组件

`EpisodeMappingInput.svelte` 可以直接使用 Bits UI primitive，而不是继承 `AsyncCombobox`。它需要展示两种不同候选：

- season candidates: season number, season title/name, overview/summary when available, episode count
- episode candidates: season number, episode number, episode title/name, air date, overview/summary

用户输入 `1/1` 才是完整合法 mapping，并解析为 `{ season: 1, episode: 1 }`。输入 `1`、`1/`、`/1`、非数字或缺任一侧时是本地 invalid editing state。

合法选择或合法输入才调用现有 `onUpdateRow({ season, episode })`。不完整输入只保留在组件本地，不写入 draft。这样不会污染后端 draft，又能在用户编辑中给出即时错误。

### 3. `EpisodeMappingInput` 区分编辑值、展示值和业务值

`EpisodeMappingInput` 内部必须明确三层值：

- business mapping: `{ season, episode }`，来自 draft props，也通过 `onUpdateRow({ season, episode })` 提交回 draft
- edit text: `5/27`，只在 input focused 或用户正在编辑时显示和解析
- display label: `S05E27 · 第13期：抉择`，只在 input blurred 时展示，不参与 parse，不写入 draft

选择 TMDB episode 时，组件提交 business mapping，并保存/推导 display label。input blur 后可以展示 rich episode label；input focus 时必须转换回 `season/episode` 编辑格式。用户手动输入完整 `5/27` 且没有 episode metadata 时，blur 后可以退化展示 `S05E27`；如果同一 `tmdbId + season` 的 episode 候选缓存可用，则可以升级为 `S05E27 · <episode title>`。

这个分层避免把 `S05E27 · 第13期：抉择` 这类展示文本存入 `inputValue` 后再被 parser 误读。`parseEpisodeMappingInput` 只负责 `season/episode` 编辑格式。

### 4. 剧集候选按输入阶段切换

输入中没有 `/` 时，组件展示 season candidates。输入出现 `/` 后，左侧 season 合法时展示该 season 的 episode candidates；左侧 season 不合法时展示 invalid state，不请求 episode。

选择 season 可以把输入推进为 `season/` 的本地编辑态，但仍不提交 draft。选择 episode 会产生完整 mapping 并提交。

### 5. Row invalid 由本地编辑态和后端 draft 状态共同决定

Rename plan panel 进入最终确认时必须同时检查：

- draft row 当前后端状态是否 valid
- `EpisodeMappingInput` 是否有本地未提交 invalid/dirty 状态

如果用户临时输入 `1` 或 `1/`，即使 draft 上一版仍是 valid，也必须禁用最终确认并在当前 row 标识未完成输入。

Row-level `errorCode` / `plan.invalid` 展示归路径列负责，因为它解释的是当前 source path 到 target path 的整体计划状态。季/集列只展示剧集输入自己的局部 invalid/empty/loading/error 状态，不重复展示 draft row 的 `errorCode`。

### 6. Library path 使用通用 combobox

Library path autocomplete 适合使用 `AsyncCombobox`：父级按当前 parent path 调用 `/api/webdav/browse`，组件显示候选并在选择后写入完整 path。选择候选仍不自动触发 path test。

### 7. AGENTS 规则与实现约束

`AGENTS.md` 需要补充：优先使用 shadcn-svelte；当 UI 复杂、shadcn 没有合适组件或 shadcn 组件无法表达业务候选时，构建项目级自定义 UI 组件，并优先复用 Bits UI primitive 和 Tailwind/shadcn token，而不是修改 shadcn 基础组件。

## Risks / Trade-offs

- **Risk: Generic combobox becomes too broad.** -> Keep `AsyncCombobox` interaction-only; path and episode wrappers own business parsing.
- **Risk: Episode local invalid state diverges from draft state.** -> RenamePlanPanel owns a small row-local validity map and gates final confirmation on it.
- **Risk: Rich display label pollutes editable input value.** -> Keep edit text and blurred display label as separate state; parser only accepts `season/episode`.
- **Risk: Duplicate row invalid messages increase visual noise.** -> Show row-level `errorCode` only in the path column; reserve season/episode column for input-local state.
- **Risk: Mobile dropdown occludes dialog content.** -> Combobox popover/list must use constrained max height, viewport-aware width, and touch-sized options.
- **Risk: Bits UI API details differ from assumptions.** -> Implement with current installed `bits-ui` version and validate with Svelte MCP/autofixer and project verification commands.
- **Risk: Rich episode candidates make table rows too tall.** -> Use compact selected display in the row, rich content only inside dropdown.

## Migration Plan

1. Add `AsyncCombobox.svelte` and supporting types/tests.
2. Add `EpisodeMappingInput.svelte` and parsing/formatting helpers with tests.
3. Replace Library path suggestion UI with `AsyncCombobox`.
4. Replace TV row season/episode controls with `EpisodeMappingInput`.
5. Update `AGENTS.md` UI rules.
6. Run Svelte autofixer for touched Svelte files, then full project verification.
