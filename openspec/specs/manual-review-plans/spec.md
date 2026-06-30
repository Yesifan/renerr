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
- **THEN** UI MUST 为每一行显示 source file 完整路径、target file 预览、媒体标题、冲突状态、选中状态和 sidecar preview

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

### Requirement: Draft 最终确认

系统 SHALL 在提交 rename plan 前提供只读最终确认步骤。

#### Scenario: 用户进入最终确认

- **WHEN** selected draft rows 均有效
- **THEN** UI MUST 展示整理文件数量、跳过数量、冲突数量和覆盖数量摘要
- **AND** UI MUST 以目标完整路径作为每行最主要信息展示

#### Scenario: 最终确认展示路径

- **WHEN** UI 展示最终确认 row
- **THEN** UI MUST 展示 target full path，并将 source full path 作为辅助对照
- **AND** UI MUST NOT 使用可编辑 table 展示最终确认内容

#### Scenario: 存在无效选中 row

- **WHEN** selected draft row 缺少必要映射或 target path invalid
- **THEN** UI MUST 阻止进入最终确认，并在编辑步骤标识 invalid rows

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
