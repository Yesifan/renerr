## ADDED Requirements

### Requirement: Pending review 和 failed 支持手动 TMDB 搜索

系统 SHALL 允许所有 `pending_review` 和 `failed` item 手动搜索并指定 TMDB identity。

#### Scenario: Pending review 有候选

- **WHEN** `pending_review` item 有系统生成的候选
- **THEN** UI MUST 显示这些候选，并同时提供手动 TMDB 搜索

#### Scenario: Pending review 没有候选

- **WHEN** `pending_review` item 因 no-match 或 parse failure 没有候选
- **THEN** UI MUST 仍然提供手动 TMDB 搜索和 identity 指定

#### Scenario: 用户选择 identity

- **WHEN** 用户为 pending item 选择 TMDB result
- **THEN** 系统 MUST 保存 source identity 字段，并将 item 转为 `identified`

#### Scenario: Failed item 用户选择 identity

- **WHEN** 用户为 `failed` item 选择 TMDB result
- **THEN** 系统 MUST 保存 source identity 字段，并将 item 转为 `identified`

### Requirement: 手动 plan draft 预览

系统 SHALL 在手动整理执行前创建可预览、可编辑的 plan draft。

#### Scenario: 用户开始手动整理

- **WHEN** 用户对 `identified`、`organized` 或已有 identity 的 `failed` item 开始整理
- **THEN** 系统 MUST 读取当前 WebDAV 文件并创建 plan draft，而不是立即执行移动

#### Scenario: 用户查看 plan

- **WHEN** plan draft 被展示
- **THEN** UI MUST 为每一行显示 source file、target file、媒体映射、冲突状态、选中状态和 sidecar preview

### Requirement: 手动 plan rows 可调整

系统 SHALL 允许用户在提交手动 plan 前调整允许修改的 row 字段。

#### Scenario: 用户取消选择 row

- **WHEN** 用户取消勾选 draft row
- **THEN** 该 row MUST 从 confirmed rename plan 中排除

#### Scenario: 用户编辑 TV mapping

- **WHEN** 用户编辑 TV row 的 season 或 episode
- **THEN** target path preview MUST 根据 selected identity、mapping 和 naming template 更新

#### Scenario: 用户尝试直接编辑 target path

- **WHEN** 用户查看 draft row
- **THEN** UI MUST NOT 允许直接编辑 target path 字符串

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

### Requirement: Item detail 支持子文件整理

系统 SHALL 允许用户在 item detail flow 中整理 library item 内的文件。

#### Scenario: Item detail 实时读取文件

- **WHEN** 用户打开 library item detail
- **THEN** 系统 MUST 实时读取 WebDAV 中该 item 当前内容，而不是只依赖最近扫描缓存

#### Scenario: Item detail 合并摘要信息

- **WHEN** 系统返回 item detail DTO
- **THEN** DTO MUST 合并实时文件列表、当前命名模板符合度、最近 scan/plan/execution 摘要和文件级 execution warning

#### Scenario: Organized item 有 non-compliant 文件

- **WHEN** 用户打开包含 non-compliant 文件的 `organized` item
- **THEN** UI MUST 提供手动整理流程，并为这些文件生成 draft

#### Scenario: Identified item 尚未整理

- **WHEN** 用户打开 `identified` item
- **THEN** UI MUST 提供手动整理流程，并为该 item 文件生成 draft

### Requirement: Item detail 文件识别是即时派生结果

系统 SHALL 从实时 WebDAV 文件列表派生 item detail 中的文件识别状态。

#### Scenario: 文件符合当前命名模板

- **WHEN** item detail 读取到符合当前命名模板的视频文件
- **THEN** 系统 MUST 解析出 movie 或 season/episode 信息，并在 DTO 中标记为 compliant

#### Scenario: 文件不符合当前命名模板

- **WHEN** item detail 读取到不符合当前命名模板的视频文件
- **THEN** 系统 MUST 在 DTO 中标记为 unmatched 或 non-compliant，且不创建长期 media file 当前记录
