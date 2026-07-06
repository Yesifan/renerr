## Why

当前 Library path 和 TV 季集输入虽然已经具备候选能力，但实现仍偏向页面内联逻辑和普通 number/datalist 控件，难以提供完整键盘导航、可访问性、移动端体验和丰富候选展示。需要基于 Bits UI primitive 封装可复用 autocomplete，并为剧集映射提供更专用的输入组件。

## What Changes

- 新增可复用 `AsyncCombobox.svelte`，使用 Bits UI Combobox primitive 构建原生 input + dropdown autocomplete 交互。
- 新增专用 `EpisodeMappingInput.svelte`，用于 TV row 的季集输入和候选选择；它可以直接使用 Bits UI primitive，不要求继承通用 combobox。
- `EpisodeMappingInput` 支持用户输入 `season/episode`，例如 `1/1` 解析为 `{ season: 1, episode: 1 }` 并显示 `S01E01` 预览。
- `EpisodeMappingInput` 区分编辑值和展示值：输入框聚焦时显示 `5/27` 等可编辑格式，失焦时可展示 `S05E27 · 第13期：抉择` 等 TMDB episode label，但 rich label 不得写入 draft 或参与 parse。
- `1`、`1/` 等不完整剧集输入视为本地 invalid 编辑态，不写入 draft，不允许进入最终确认。
- 剧集候选必须区分 season 和 episode 展示：season 候选展示季号、季标题/简介、集数等；episode 候选展示第几季第几集、集标题、播出日期、简介等。
- 使用新的 `AsyncCombobox` 替换 Library path autocomplete；使用 `EpisodeMappingInput` 替换 rename plan TV row 的季/集输入。
- rename plan row 的 `plan.invalid` / `errorCode` 只在路径列显示；季/集列不得重复展示同一 row-level invalid 信息。
- 更新 `AGENTS.md` 规则：当 UI 复杂且 shadcn-svelte 没有可用组件时，应该构建项目级自定义 UI 组件，可直接使用 Bits UI primitive。

## Capabilities

### New Capabilities

### Modified Capabilities

- `manual-review-plans`: TV rename plan row 的季集输入交互从两个数字输入升级为专用剧集映射输入。
- `connectivity-testing`: Library path 目录候选改为复用项目级 AsyncCombobox 组件承载。
- `ui-shell-and-theme`: 复杂 UI 组件选型规则增加“shadcn 不覆盖时构建项目级自定义组件”的要求。

## Impact

- Affected frontend components: `RenamePlanPanel.svelte`, `LibraryPathDialog.svelte`, new shared UI/business components under `src/lib/components` or route-local components.
- Affected client helpers/types: path suggestion helpers, TMDB season/episode option DTO usage, query keys and tests.
- Affected docs: `AGENTS.md` UI rules.
- No database schema changes; draft persistence remains `season` and `episode` numeric fields.
