## MODIFIED Requirements

### Requirement: 执行结果更新 item 摘要

系统 SHALL 在整理成功后同步更新 `library_items` 的 identity 状态和文件统计；执行失败只记录在 task、log 和 execution records 中。

#### Scenario: 所有 selected plan items 成功

- **WHEN** rename plan 对某个 library item 的 selected rows 全部执行成功
- **THEN** 系统 MUST 将该 item 标记为 `organized`
- **AND** 系统 MUST 更新 video、compliant、non-compliant 统计

#### Scenario: 部分或全部 plan items 失败

- **WHEN** rename plan 对某个 library item 的任意 selected row 执行失败
- **THEN** 系统 MUST 在 task、log 或 execution records 中保留失败原因
- **AND** 系统 MUST NOT 将该 item 标记为 `failed`
