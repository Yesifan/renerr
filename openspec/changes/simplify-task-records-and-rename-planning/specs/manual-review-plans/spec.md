## MODIFIED Requirements

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
