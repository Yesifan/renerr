## ADDED Requirements

### Requirement: WebDAV organize target path 测试

系统 SHALL 支持测试 Library Path 的整理目标目录是否可读。该测试 MUST 使用与 Library Path path 测试相同的 WebDAV source 凭据和只读 list 行为，并且 MUST NOT 创建、移动、删除或改写远端文件。

#### Scenario: Organize target path 可读

- **WHEN** 用户测试存在且可 list 的整理目标目录
- **THEN** 系统 MUST 返回成功
- **AND** 系统 MUST NOT 声称已验证写权限

#### Scenario: Organize target path 不可读

- **WHEN** 用户测试不存在或无法 list 的整理目标目录
- **THEN** 系统 MUST 返回稳定 error code
- **AND** 系统 MUST NOT 在测试中创建该目录

#### Scenario: Organize target path 测试不泄漏 secret

- **WHEN** 整理目标目录测试失败
- **THEN** API 响应和日志 MUST NOT 泄漏 WebDAV 明文凭据、加密凭据或 token

### Requirement: 整理目标目录输入提供目录候选

系统 SHALL 在添加或编辑 Library Path 的整理目标目录时提供基于当前 WebDAV source 的目录下拉候选和 autocomplete。候选加载 SHALL 使用只读目录读取，不得创建、移动、删除或改写远端路径。

#### Scenario: 用户编辑 organize target path 输入

- **WHEN** 用户在整理目标目录输入框中输入远端路径
- **THEN** UI MUST 根据当前 source 和输入 path 的父目录提供 directory 候选
- **AND** 候选 MUST 只包含直接子目录
- **AND** UI MUST 保留手动输入能力

#### Scenario: 用户测试 organize target path

- **WHEN** 用户在添加或编辑 Library Path 时填写整理目标目录
- **THEN** UI MUST 提供测试该整理目标目录的动作
- **AND** 测试动作 MUST 使用当前输入的 source 和整理目标目录
