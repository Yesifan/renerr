## MODIFIED Requirements

### Requirement: Draft 最终确认

系统 SHALL 在提交 rename plan 前提供只读最终确认步骤，并在确认区展示本次计划关联的影视信息摘要。

#### Scenario: 用户进入最终确认

- **WHEN** selected draft rows 均有效
- **THEN** UI MUST 展示整理文件数量、跳过数量、冲突数量、覆盖数量和 no-op 数量摘要
- **AND** UI MUST 以目标完整路径作为每行最主要信息展示
- **AND** UI MUST 展示本次计划使用的影视标题、年份、媒体类型、TMDB identity 和海报信息

#### Scenario: 最终确认展示路径

- **WHEN** UI 展示最终确认 row
- **THEN** UI MUST 展示 target full path，并将 source full path 作为辅助对照
- **AND** UI MUST NOT 使用可编辑 table 展示最终确认内容

#### Scenario: 存在无效选中 row

- **WHEN** selected draft row 缺少必要映射或 target path invalid
- **THEN** UI MUST 阻止进入最终确认，并在编辑步骤标识 invalid rows

#### Scenario: 存在 no-op row

- **WHEN** draft 中存在 source path 与 target path 相同的 no-op row
- **THEN** UI MUST 在编辑和最终确认摘要中显示该 row 被跳过
- **AND** UI MUST NOT 要求用户处理该 row 的覆盖冲突

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

## ADDED Requirements

### Requirement: TMDB 搜索展示明确 loading 状态

系统 SHALL 在手动指定和 plan row 搜索 TMDB 时展示局部 loading、空结果和错误状态。

#### Scenario: 手动指定搜索中

- **WHEN** 用户在手动指定 dialog 中触发 TMDB 搜索且请求未完成
- **THEN** UI MUST 禁用当前搜索按钮
- **AND** UI MUST 在结果区域展示搜索中的状态

#### Scenario: plan row 搜索中

- **WHEN** 用户在 rename plan row 中触发 TMDB 搜索且请求未完成
- **THEN** UI MUST 只展示该 row 搜索区域的 loading 状态
- **AND** UI MUST NOT 因局部搜索隐藏整个 plan dialog

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
