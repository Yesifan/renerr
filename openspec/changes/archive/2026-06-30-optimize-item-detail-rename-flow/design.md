## Context

Item detail 当前用右侧摘要 card 承载海报、统计和手动指定，rename plan 也以内联 card 形式出现，导致详情页不像一个完整的媒体文件核对工作台。后端 rename plan draft 已用 `rows_json` 保存可编辑行，confirmed `rename_plan_items` 已保存执行所需的 source/target、`source_media_id`、season/episode、overwrite 和 sidecars；执行器当前会把执行失败写回 `library_items.status = failed`，混淆了识别失败与整理任务失败。

## Goals / Non-Goals

**Goals:**

- 让 item detail 页面直接展示海报、影视身份、完整路径和状态统计，并将实时远端文件列表放入用户主动打开的文件区。
- 用宽 dialog 承载手动指定和执行计划的多步流程。
- 支持 draft row 级 TMDB override，用 TMDB 搜索结果改行级标题/年份并重算目标路径。
- 简化 item 状态：识别失败统一进入 `pending_review`，重命名执行失败只进入任务、日志和 execution records。
- 保持 confirmed rename plan 的执行模型稳定，不扩展 `rename_plan_items` 表结构。

**Non-Goals:**

- 不允许用户自由输入任意标题绕过 TMDB identity。
- 不把 organized item 重新开放手动指定入口。
- 不在媒体库主页或 item 媒体信息区展示重命名执行失败提示。
- 不引入新的 UI 组件库或播放/推荐型媒体体验。

## Decisions

### Decision: UI 实现必须先加载设计与 Svelte 技能

实现任何 item detail、manual match dialog、rename plan dialog 或 `.svelte` 组件改动前，执行者 MUST 使用 `/impeccable` 技能读取项目产品/设计上下文，并按 product UI register 保持深色管理台、克制状态色、非营销化布局和可核对路径信息。凡涉及 `.svelte` 或 `.svelte.ts/.svelte.js` 的创建、编辑、分析，执行者 MUST 使用 `/svelte-code-writer` 技能，先通过 Svelte MCP 获取相关 Svelte/SvelteKit 文档，完成后对改动组件运行 Svelte autofixer。

Alternative considered: 只在最终验证阶段运行 Svelte check。这样能发现类型和编译错误，但不能提前约束交互设计质量、Svelte 5 runes 写法和组件级可访问性问题。

### Decision: Draft row 承载行级媒体展示和重算字段

`RenamePlanDraftRow` 增加只存在于 draft JSON 中的 `title`、`originalTitle`、`year`、`posterPath`/`posterUrl` 字段。创建 draft 时这些字段来自 item identity；用户在某一行通过 TMDB 搜索选择结果后，只更新该 row 的 `sourceMediaId/title/originalTitle/year/posterPath`，并用当前 season/episode 重算 `targetFilePath`。

Alternative considered: 把完整媒体信息同步到 `rename_plan_items`。当前执行器只依赖固化后的 target path，且 plan item 已有 `source_media_id`、season、episode；扩表会增加迁移和测试成本，收益不足。

### Decision: 行级更换影视信息只影响当前 row

Row-level TMDB override 不修改 item 主 identity，也不批量影响其他 rows。TV 行保留已有 season/episode；仅在缺失时继续使用文件名解析结果补齐。

Alternative considered: 应用到整个计划或直接更新 item identity。这样适合单 item 单 identity，但无法处理顶层目录混入不同影视文件的修正场景，也会让用户误改整个 item。

### Decision: 实时文件列表按需展示

详情页默认展示媒体身份、路径摘要、统计和操作按钮，不默认展开实时文件列表。用户打开文件区或进入计划生成流程时，再实时读取 WebDAV 内容；计划生成仍以远端当前文件为事实来源。

Alternative considered: 默认展示完整实时文件列表。它能减少一次点击，但会占据首屏焦点，并让用户在开始手动指定或执行计划前先面对大量路径噪音。

### Decision: 多步流程放在宽 Dialog

手动指定流程：候选/搜索 TMDB → 保存 item identity 并创建 draft → 编辑 draft rows → 最终确认目标路径 → 提交执行。执行计划流程：创建 draft → 编辑 draft rows → 最终确认目标路径 → 提交执行。最终确认不用 table，以目标完整路径为主要信息，源路径和媒体映射作为辅助。

Alternative considered: 页面内展开计划工作区。长表格空间更大，但会重新挤占详情页主体，让页面难以同时承担媒体核对和高风险确认。

### Decision: `pending_review` 覆盖所有需人工识别的 item

扫描无法高置信识别时一律写入 `pending_review`，`recognitionCandidates` 可以为空。旧 `failed` item 运行时或迁移时按是否已有 identity 拆分：有 identity 转 `identified`，无 identity 转 `pending_review`。执行器不再写回 item status 为 `failed`。

Alternative considered: 新增 `identification_failed`。它能表达无候选识别失败，但会增加状态分支；空候选的 `pending_review` 已足够表达“需要人工指定”。

## Risks / Trade-offs

- [Risk] Row-level override 只存 draft，用户提交后看不到结构化标题快照 → Mitigation: confirmed plan 保留 `source_media_id` 和最终 target path；完整审计需要时再单独扩展 plan item metadata。
- [Risk] 宽 dialog 内长路径和表格在小屏拥挤 → Mitigation: 编辑步骤表格横向滚动，确认步骤改为目标路径列表；移动端 dialog 使用接近全屏宽度。
- [Risk] 旧 `failed` 状态语义不明确 → Mitigation: 以是否有 identity 作为唯一迁移规则，并让新代码不再产生 `failed` item status。
- [Risk] 行内 TMDB 搜索可能造成多行独立加载状态复杂 → Mitigation: 以 row id 管理展开行、搜索 query、结果和 pending 状态，避免全局候选串行污染。
