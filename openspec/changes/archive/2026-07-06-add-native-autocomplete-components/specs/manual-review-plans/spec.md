## MODIFIED Requirements

### Requirement: TV plan row 提供 TMDB 季集候选

系统 SHALL 在 rename plan draft 编辑阶段为 TV row 提供来自当前 TMDB identity 的 season 和 episode 候选项。候选项 SHALL 作为辅助选择，不得替代用户最终确认的 row mapping。TV row SHALL 使用专用剧集映射输入组件展示和编辑 season/episode mapping。
候选项 SHALL NOT 写入 rename plan draft DTO。
TV row 的 row-level invalid/errorCode 信息 SHALL 只在路径列展示；季/集列 SHALL 只展示季集输入相关的局部状态，不得重复展示同一 row-level invalid 信息。

#### Scenario: TV row 加载 season 候选

- **WHEN** 用户打开包含 TV row 的 rename plan draft
- **THEN** UI MUST 为每个有 `sourceMediaId` 的 TV row 提供 season 候选
- **AND** 候选 MUST 来自该 row 当前 TMDB TV identity
- **AND** season 候选 MUST 展示 season number、season name/title、episode count 和简介/概览（如果 TMDB 返回）
- **AND** 当前 row 已有 season MUST 在控件中可见，即使它不在 TMDB 返回的候选中

#### Scenario: 用户输入完整季集

- **WHEN** 用户输入 `1/1`
- **THEN** UI MUST parse it as `season: 1` and `episode: 1`
- **AND** UI MUST show an `S01E01` preview
- **AND** 系统 MUST 使用现有 draft row 更新流程保存对应数字
- **AND** target path preview MUST 根据 row identity、mapping 和 naming template 更新
- **AND** draft row 的 selected、conflict、noop 和 valid 状态 MUST 按现有规则重新计算

#### Scenario: 剧集输入聚焦时显示编辑值

- **WHEN** TV mapping input 获得焦点
- **AND** 当前 row 已有 `season: 5` and `episode: 27`
- **THEN** input MUST display editable text `5/27`
- **AND** UI MUST NOT display `S05E27 · <episode title>` inside the focused input value
- **AND** parser MUST only parse the editable `season/episode` format

#### Scenario: 剧集输入失焦时显示候选标签

- **WHEN** TV mapping input 失去焦点
- **AND** 当前 row 已有 `season: 5` and `episode: 27`
- **AND** TMDB episode metadata for that mapping is available
- **THEN** input MAY display `S05E27 · <episode title>` as a read-only display label
- **AND** display label MUST NOT be written to draft
- **AND** display label MUST NOT be parsed as user input
- **AND** focusing the input again MUST restore editable text `5/27`

#### Scenario: 手动输入缺少 episode metadata

- **WHEN** 用户手动输入完整 `5/27`
- **AND** TMDB episode metadata for season 5 episode 27 is unavailable
- **THEN** UI MUST commit `season: 5` and `episode: 27`
- **AND** blurred display MAY fall back to `S05E27`
- **AND** UI MUST NOT require rich episode metadata to save the mapping

#### Scenario: 用户输入不完整季集

- **WHEN** 用户输入 `1`、`1/`、`/1`、空值或非数字季集格式
- **THEN** UI MUST treat the input as local invalid editing state
- **AND** UI MUST NOT write that incomplete value to the draft
- **AND** UI MUST prevent entering final confirmation until the input is completed, reverted, or cleared to a valid draft state

#### Scenario: 用户输入斜杠前查看 season 候选

- **WHEN** 用户编辑 TV mapping input 且输入尚未包含 `/`
- **THEN** UI MUST show season candidates for the current row TMDB identity
- **AND** selecting a season MAY update the local input to `<season>/`
- **AND** selecting a season alone MUST NOT write a draft update

#### Scenario: 用户输入斜杠后查看 episode 候选

- **WHEN** 用户编辑 TV mapping input 且输入包含 `/`
- **AND** slash 前的 season 是合法数字
- **THEN** UI MUST show episode candidates for that season
- **AND** episode candidates MUST display season number, episode number, episode title/name, air date and overview/summary when available
- **AND** selecting an episode MUST write both season and episode through the existing draft row update flow
- **AND** selecting an episode MAY update the blurred display label to include the episode title/name
- **AND** selecting an episode MUST NOT store the rich display label in the draft `season` or `episode` fields

#### Scenario: 用户只修改 season

- **WHEN** 用户通过专用剧集输入提交新的完整 mapping 且 episode 数字未变化
- **THEN** 系统 MUST 保留该 row 当前 episode
- **AND** 系统 MUST NOT 自动清空 episode
- **AND** target path preview 和 row 状态 MUST 按现有 draft row 更新规则重新计算

#### Scenario: TMDB 候选不可用

- **WHEN** TMDB API key 缺失、TMDB 请求失败、identity 不是 TV 或候选为空
- **THEN** UI MUST 展示局部空状态或错误状态
- **AND** UI MUST 继续允许用户输入完整 `season/episode`
- **AND** 系统 MUST NOT 因候选不可用而阻止 draft 提交，除非 row 仍缺少必要 mapping

#### Scenario: Row identity 被更换

- **WHEN** 用户为 TV draft row 选择新的 TMDB result
- **THEN** UI MUST 使用新的 row identity 重新加载 season 和 episode 候选
- **AND** 系统 MUST 保留该 row 已有 season 和 episode，除非用户明确选择新值

#### Scenario: Row invalid 信息只在路径列显示

- **WHEN** rename plan draft row has `status: invalid` and an `errorCode` such as `plan.invalid`
- **THEN** path column MUST display the row-level invalid/errorCode information
- **AND** season/episode column MUST NOT duplicate the same row-level invalid/errorCode information
- **AND** season/episode column MAY still show local input validation, loading, empty, or TMDB candidate error states
