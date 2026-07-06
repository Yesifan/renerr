## Purpose

定义 pending review、手动 TMDB 指定、rename plan draft 编辑和最终确认的交互与数据规则。
## Requirements
### Requirement: Pending review 和 failed 支持手动 TMDB 搜索

系统 SHALL 允许所有 `pending_review` item 手动搜索并指定 TMDB identity；`pending_review` MAY 包含系统候选，也 MAY 没有候选。

#### Scenario: Pending review 有候选

- **WHEN** `pending_review` item 有系统生成的候选
- **THEN** UI MUST 优先显示这些候选，并同时提供手动 TMDB 搜索

#### Scenario: Pending review 没有候选

- **WHEN** `pending_review` item 因 no-match 或 parse failure 没有候选
- **THEN** UI MUST 仍然提供手动 TMDB 搜索和 identity 指定

#### Scenario: 用户选择 identity

- **WHEN** 用户为 pending item 选择 TMDB result
- **THEN** 系统 MUST 保存 source identity 字段，并将 item 转为 `identified`
- **AND** UI MUST 继续进入 rename plan draft 编辑流程

#### Scenario: 用户修改 identified item 的 identity

- **WHEN** 用户为 `identified` item 重新选择 TMDB result
- **THEN** 系统 MUST 保存新的 source identity 字段，并继续进入 rename plan draft 编辑流程

### Requirement: 手动 plan draft 预览

系统 SHALL 在手动整理执行前创建可预览、可编辑的 plan draft。

#### Scenario: 用户开始手动整理

- **WHEN** 用户对 `identified` item 或包含 non-compliant 文件的 `organized` item 开始整理
- **THEN** 系统 MUST 读取当前 WebDAV 文件并创建 plan draft，而不是立即执行移动

#### Scenario: 用户查看 plan

- **WHEN** plan draft 被展示
- **THEN** UI MUST 为每一行显示 source file 文件名、source directory path、target file 文件名、target directory path、媒体标题、冲突状态、选中状态和 sidecar preview
- **AND** source and target filenames MUST be visually separate from their directory paths
- **AND** long filenames and paths MUST wrap instead of forcing table overflow or hiding critical text

#### Scenario: 用户从手动指定进入 plan

- **WHEN** 用户在手动指定流程中选择 TMDB identity
- **THEN** 系统 MUST 保存 item identity 后创建 plan draft

### Requirement: 手动 plan rows 可调整

系统 SHALL 允许用户在提交手动 plan 前调整允许修改的 row 字段。

#### Scenario: 用户取消选择 row

- **WHEN** 用户取消勾选 draft row
- **THEN** 该 row MUST 从 confirmed rename plan 中排除

#### Scenario: 用户编辑 TV mapping

- **WHEN** 用户编辑 TV row 的 season 或 episode
- **THEN** target path preview MUST 根据 row identity、mapping 和 naming template 更新

#### Scenario: 用户尝试直接编辑 target path

- **WHEN** 用户查看 draft row
- **THEN** UI MUST NOT 允许直接编辑 target path 字符串

#### Scenario: 用户通过 TMDB 更换单行影视信息

- **WHEN** 用户在 draft row 中搜索并选择 TMDB result
- **THEN** 系统 MUST 更新该 row 的 `sourceMediaId`、标题、原始标题、年份和海报信息
- **AND** 系统 MUST 只重算该 row 的 target path，不修改 item 主 identity 或其他 rows

#### Scenario: 用户更换 TV row identity

- **WHEN** 用户为 TV draft row 选择新的 TMDB result
- **THEN** 系统 MUST 保留该 row 已有 season 和 episode
- **AND** 当 season 或 episode 缺失时，系统 MUST 尝试从 source file path 解析补齐

#### Scenario: 用户尝试自由输入标题

- **WHEN** 用户需要修改 draft row 标题
- **THEN** UI MUST 要求用户通过 TMDB 搜索结果选择 identity，而不是提供任意标题输入

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

### Requirement: Draft 最终确认

系统 SHALL 在提交 rename plan 前提供只读最终确认步骤，并在确认区展示本次计划关联的影视信息摘要。

#### Scenario: 用户进入最终确认

- **WHEN** selected draft rows 均有效
- **THEN** UI MUST 展示整理文件数量、跳过数量、冲突数量、覆盖数量和 no-op 数量摘要
- **AND** UI MUST 以目标文件名作为每行最主要信息展示
- **AND** UI MUST 在目标文件名下方展示目标 directory path
- **AND** UI MUST 展示本次计划使用的影视标题、年份、媒体类型、TMDB identity 和海报信息

#### Scenario: 最终确认展示路径

- **WHEN** UI 展示最终确认 row
- **THEN** UI MUST 展示 target filename and target directory path，并将 source filename and source directory path 作为辅助对照
- **AND** long filenames and paths MUST remain readable and copyable
- **AND** UI MUST NOT 使用可编辑 table 展示最终确认内容

#### Scenario: 存在无效选中 row

- **WHEN** selected draft row 缺少必要映射或 target path invalid
- **THEN** UI MUST 阻止进入最终确认，并在编辑步骤标识 invalid rows

#### Scenario: 存在 no-op row

- **WHEN** draft 中存在 source path 与 target path 相同的 no-op row
- **THEN** UI MUST 在编辑和最终确认摘要中显示该 row 被跳过
- **AND** UI MUST NOT 要求用户处理该 row 的覆盖冲突

### Requirement: 手动冲突处理

系统 SHALL 要求用户显式处理手动 plan 中的 target file conflict。

#### Scenario: 冲突未处理

- **WHEN** selected draft row 有 target file conflict 且没有 conflict action
- **THEN** 系统 MUST 阻止 plan 提交

#### Scenario: 选择 force overwrite

- **WHEN** 用户对一个或多个 conflict rows 选择 force overwrite
- **THEN** UI MUST 在创建 confirmed rename plan 前要求二次确认

### Requirement: Draft 提交前校验

系统 SHALL 在创建 confirmed rename plan 前校验 plan draft。

#### Scenario: 缺少必要 mapping

- **WHEN** selected draft row 缺少必要 movie 或 TV mapping 字段
- **THEN** 提交 MUST 失败并返回稳定 error code，UI MUST 标识 invalid rows

#### Scenario: 选中 rows 均有效

- **WHEN** 所有 selected rows 均有效
- **THEN** 系统 MUST 创建只包含 selected rows 的 confirmed `rename_plan`
- **AND** confirmed `rename_plan_items` MUST 使用现有 source path、target path、media kind、source media id、season、episode、overwrite 和 sidecars 字段

#### Scenario: no-op rows 未选中

- **WHEN** draft 中存在未选中的 no-op rows
- **THEN** 提交 MUST 允许继续
- **AND** confirmed `rename_plan_items` MUST 排除这些 no-op rows

#### Scenario: no-op rows 被错误选中

- **WHEN** draft submit payload 试图选中 source path 与 target path 相同的 no-op row
- **THEN** 系统 MUST 拒绝该 row 进入 confirmed rename plan 或返回稳定校验错误

### Requirement: TMDB 搜索展示明确 loading 状态

系统 SHALL 在手动指定和 plan row 搜索 TMDB 时展示局部 loading、空结果和错误状态。TMDB search results SHALL include enough display data for a rich selection UI, including poster URL and overview when available.

#### Scenario: 手动指定搜索中

- **WHEN** 用户在手动指定 dialog 中触发 TMDB 搜索且请求未完成
- **THEN** UI MUST 禁用当前搜索按钮
- **AND** UI MUST 在结果区域展示搜索中的状态

#### Scenario: plan row 搜索中

- **WHEN** 用户在 rename plan row 中触发 TMDB 搜索且请求未完成
- **THEN** UI MUST 只展示该 row 搜索区域的 loading 状态
- **AND** UI MUST NOT 因局部搜索隐藏整个 plan dialog

#### Scenario: TMDB 搜索结果展示海报和简介

- **WHEN** TMDB 搜索完成且返回结果
- **THEN** API result MUST include title, original title, year, poster path, poster URL, and overview when available
- **AND** UI MUST display poster, title, year, and overview summary for each result when available

#### Scenario: TMDB 搜索无结果

- **WHEN** TMDB 搜索完成且结果为空
- **THEN** UI MUST 展示明确的空结果提示

#### Scenario: TMDB 搜索失败

- **WHEN** TMDB 搜索请求失败
- **THEN** UI MUST 展示可理解的错误提示
- **AND** UI MUST 允许用户修改查询后再次搜索

### Requirement: 手动 plan draft 标识 no-op rows

系统 SHALL 在 plan draft 编辑阶段明确标识无需整理的 no-op rows。

#### Scenario: 显示 no-op row

- **WHEN** draft row 的 source path 与 target path 完全相同
- **THEN** UI MUST 显示“无需整理”或等价状态
- **AND** UI MUST 默认取消勾选该 row
- **AND** UI MUST 禁止将该 row 当作待覆盖冲突处理

#### Scenario: 用户修改 no-op row mapping

- **WHEN** 用户修改 no-op row 的影视信息、season 或 episode
- **AND** 新 target path 与 source path 不同
- **THEN** UI MUST 允许该 row 重新被选中
- **AND** UI MUST 展示新 target path 和冲突状态

### Requirement: Item detail 支持子文件整理

系统 SHALL 允许用户在 item detail flow 中为 library item 内的文件创建整理计划，但 item detail 页面不直接展示实时文件列表。

#### Scenario: Item detail 合并摘要信息

- **WHEN** 系统返回 item detail DTO
- **THEN** DTO MUST 合并当前命名模板符合度和最近 scan/plan/execution 摘要
- **AND** DTO MUST NOT 要求 item detail 页面加载实时文件列表

#### Scenario: Organized item 有 non-compliant 文件

- **WHEN** 用户打开包含 non-compliant 文件的 `organized` item
- **THEN** UI MUST 提供执行计划流程，并为这些文件生成 draft

#### Scenario: Organized item 无 non-compliant 文件

- **WHEN** 用户打开没有 non-compliant 文件的 `organized` item
- **THEN** UI MUST NOT 显示手动指定入口
- **AND** UI MUST NOT 显示执行计划入口

#### Scenario: Identified item 尚未整理

- **WHEN** 用户打开 `identified` item
- **THEN** UI MUST 提供执行计划流程和手动指定流程

