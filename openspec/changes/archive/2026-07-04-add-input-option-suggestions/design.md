## Context

Renarr 的手动整理流程已经通过 rename plan draft 承载 row 级编辑，TV row 目前允许用户直接输入 season 和 episode，并由 `updateDraft` 重算 target path。TMDB service 目前提供搜索和连通性测试，但没有暴露 TV season/episode metadata。WebDAV source 已有只读 `browseWebdav(sourceId, path)` 和 `/api/webdav/browse`，library path 添加 dialog 目前仍是纯文本路径输入。

本变更要增强输入体验，而不是改变整理语义：用户最终保存的仍是 draft row 的 season/episode 数字和 Library path 字符串；候选项只作为可选辅助。

## Goals / Non-Goals

**Goals:**

- 为 TV rename plan row 提供基于当前 TMDB identity 的 season/episode 候选。
- 用户选择 season 后，episode 候选随 season 更新，并展示 TMDB episode 名称辅助确认。
- 添加 Library path 时，`LibraryPathDialog.svelte` 的 path 输入支持目录候选、autocomplete 和逐级浏览，保存仍以输入框最终 path 为准。
- 所有候选加载都保持只读，不写数据库，不创建远端目录。
- 请求失败、无 API key、无目录权限或 TMDB 数据缺失时，UI 保持手动输入可用。

**Non-Goals:**

- 不改变 naming template、target path 生成规则或 confirmed rename plan schema。
- 不长期缓存 TMDB season/episode metadata 到 SQLite。
- 不为 movie row 提供 season/episode 控件。
- 不实现远端目录创建、写权限测试、递归扫描目录树或编辑已有 Library path。

## Decisions

### 1. 使用按需 API 获取 TMDB TV mapping 选项

新增服务函数从 TMDB `tv/{id}` 获取 season 列表，并从 `tv/{id}/season/{season_number}` 获取 episode 列表。API 返回面向 UI 的稳定 DTO，但不把这些 options 写入 rename plan draft DTO，例如：

- `seasons`: `number`, `name`, `episodeCount`, `airDate`
- `episodes`: `season`, `episode`, `name`, `airDate`, `overview`

API 使用直接 TMDB 语境，例如 `/api/tmdb/tv/{tmdbId}/seasons` 和 `/api/tmdb/tv/{tmdbId}/seasons/{season}/episodes`，而不是挂在 rename plan draft row 下。

原因：season list 和 episode list 是外部 metadata，只依赖 TMDB TV id 和 season，不属于 rename plan draft 的持久业务状态。按需获取可以避免 schema 变更，也能让 row identity 切换后直接读取新 identity 的候选。draft DTO 继续只表达用户正在编辑和提交的整理业务状态。

备选方案一是创建 draft 时把所有候选写入 draft JSON；这会放大 draft payload，且 row identity 变更后仍要重新取数，因此不采用。备选方案二是通过 `/api/rename-plan-drafts/{draftId}/rows/{rowId}/...` 查询候选；这会把外部 metadata 查询绑定到 draft 生命周期，降低复用性，因此不采用。

### 2. 候选项不替代手动输入和解析结果

Rename plan row 保留现有 numeric 输入语义，UI 使用 option-backed numeric input 或 combobox，而不是封闭 select。当前 row 已有 season/episode 即使不在 TMDB 返回结果里，也必须作为可显示当前值保留，避免用户看到空控件或被迫改值。

原因：TMDB 数据可能缺少特别篇、拆分季、绝对集数或用户自定义命名需要。整理系统的 source of truth 仍是用户确认的 draft row。

当用户只修改 season 时，系统不自动清空 episode。episode 仍按当前 row 值保留，直到用户明确修改；target path、valid、conflict 和 noop 状态由现有 draft 更新流程重新计算。

### 3. Library path 候选复用 browseWebdav 边界

添加 Library path 时，`LibraryPathDialog.svelte` 的 path 输入通过当前 source id 和当前输入 path 的父目录调用 `/api/webdav/browse`，只展示 directory entries。输入框提供 autocomplete；用户也可以点选目录把 path 更新为对应完整远端路径。候选请求以父目录为粒度；例如输入 `/tv/Sh` 时只请求 `/tv` 的直接子目录，并在前端用 `Sh` 过滤结果。只有父目录变化时才重新请求，不做远端搜索。选择候选只更新输入值，不自动触发现有 path test；用户仍通过“测试”或“保存”触发校验。

原因：`browseWebdav` 已经封装 source 凭据和只读 listDirectory 行为，符合现有 WebDAV URL 不能自动改写的约束。复用此边界避免新增一套路径发现逻辑。

备选方案一是前端一次性加载整棵目录树；这会对大 WebDAV 目录产生不可控请求量，并违反现有逐级浏览规则，因此不采用。备选方案二是按每个输入字符远端搜索；WebDAV/AList 不提供统一搜索语义，且会制造高频 list 请求，因此也不采用。备选方案三是选中候选后自动测试 path；这会把 autocomplete 和连通性校验耦合，制造额外请求和状态复杂度，因此不采用。

### 4. 前端状态归属保持页面/业务组件内

`RenamePlanPanel.svelte` 接收或自行查询 row 级 TMDB mapping options，但更新 draft 仍通过现有 `onUpdateRow` 回调。`LibraryPathDialog.svelte` 接收 path browse callback 或在页面持有异步状态，保存和测试仍走现有 mutation。

原因：保持现有 SvelteKit data boundary，避免子组件创建不相关全局状态；Svelte Query keys 需要扩展到 TMDB TV options 和 WebDAV path suggestions。

## Risks / Trade-offs

- TMDB 请求增加可能触发 rate limit -> 对同一 row identity/season 使用 Svelte Query 缓存，并在失败时展示局部错误而不阻断手动输入。
- TMDB 特别篇 season 0 或缺失 episode count 容易被误隐藏 -> 不过滤 season 0，UI 按 TMDB 返回排序展示，同时保留当前值。
- WebDAV 大目录候选可能很多 -> 只读取当前目录直接子目录，前端按输入文本过滤并限制展示数量。
- 路径输入和点选可能产生斜杠规范差异 -> 后端继续使用 `normalizeRemotePath`，前端显示完整远端 path，提交前不自行改写 source URL。
- source 凭据错误会让 autocomplete 失败 -> UI 显示局部错误，并保留手动输入和连接测试入口。

## Migration Plan

无需数据库迁移。实现顺序为：先补 TMDB/WebDAV 候选服务和 API，再接入 query keys 与 UI 控件，最后补充测试。回滚时可移除新 API 和 UI 候选逻辑，现有手动输入、path 保存、测试和 rename plan 提交流程不受影响。
