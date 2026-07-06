## ADDED Requirements

### Requirement: TV plan row 提供 TMDB 季集候选

系统 SHALL 在 rename plan draft 编辑阶段为 TV row 提供来自当前 TMDB identity 的 season 和 episode 候选项。候选项 SHALL 作为辅助选择，不得替代用户最终确认的 row mapping。season 和 episode 控件 SHALL 保持可输入候选外数字。
候选项 SHALL NOT 写入 rename plan draft DTO。

#### Scenario: TV row 加载 season 候选

- **WHEN** 用户打开包含 TV row 的 rename plan draft
- **THEN** UI MUST 为每个有 `sourceMediaId` 的 TV row 提供 season 下拉候选
- **AND** 候选 MUST 来自该 row 当前 TMDB TV identity
- **AND** 当前 row 已有 season MUST 在控件中可见，即使它不在 TMDB 返回的候选中
- **AND** 用户 MUST 能输入候选外 season 数字

#### Scenario: 用户选择 season 后加载 episode 候选

- **WHEN** 用户为 TV row 选择或输入 season
- **THEN** UI MUST 基于该 row 当前 TMDB TV identity 和 season 提供 episode 下拉候选
- **AND** episode 候选 MUST 展示集号，并在 TMDB 有数据时展示 episode name
- **AND** 当前 row 已有 episode MUST 在控件中可见，即使它不在 TMDB 返回的候选中
- **AND** 用户 MUST 能输入候选外 episode 数字

#### Scenario: 用户选择 season 或 episode

- **WHEN** 用户从候选中选择 season 或 episode
- **THEN** 系统 MUST 使用现有 draft row 更新流程保存对应数字
- **AND** target path preview MUST 根据 row identity、mapping 和 naming template 更新
- **AND** draft row 的 selected、conflict、noop 和 valid 状态 MUST 按现有规则重新计算

#### Scenario: 用户只修改 season

- **WHEN** 用户修改 TV row 的 season
- **THEN** 系统 MUST 保留该 row 当前 episode
- **AND** 系统 MUST NOT 自动清空 episode
- **AND** target path preview 和 row 状态 MUST 按现有 draft row 更新规则重新计算

#### Scenario: TMDB 候选不可用

- **WHEN** TMDB API key 缺失、TMDB 请求失败、identity 不是 TV 或候选为空
- **THEN** UI MUST 展示局部空状态或错误状态
- **AND** UI MUST 继续允许用户手动编辑 season 和 episode
- **AND** 系统 MUST NOT 因候选不可用而阻止 draft 提交，除非 row 仍缺少必要 mapping

#### Scenario: Row identity 被更换

- **WHEN** 用户为 TV draft row 选择新的 TMDB result
- **THEN** UI MUST 使用新的 row identity 重新加载 season 和 episode 候选
- **AND** 系统 MUST 保留该 row 已有 season 和 episode，除非用户明确选择新值
