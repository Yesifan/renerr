## ADDED Requirements

### Requirement: Library Path 目标目录 UI 文案使用 Paraglide messages

系统 SHALL 对 Library Path 整理目标目录相关的新增和修改前端用户可见文案使用 `@inlang/paraglide-js` messages。Svelte components MUST import messages from `$lib/i18n` and MUST NOT introduce hard-coded Chinese copy for this feature.

#### Scenario: 添加 Library Path 时展示目标目录文案

- **WHEN** 用户打开添加 Library Path 对话框
- **AND** UI 展示整理到其他目录开关、目标目录输入、测试动作、候选状态或说明文案
- **THEN** 这些用户可见文案 MUST 通过 Paraglide message 函数渲染

#### Scenario: 编辑 Library Path 目标目录时展示文案

- **WHEN** 用户在 Settings 中编辑已有 Library Path 的整理目标目录
- **THEN** 编辑入口、字段标签、保存动作、取消动作、测试动作和错误提示 MUST 通过 Paraglide message 函数渲染

#### Scenario: 目标目录校验失败

- **WHEN** API 返回目标目录相关的已知 validation error code
- **THEN** 前端 MUST 使用 Paraglide messages 显示本地化中文错误
- **AND** UI MUST NOT 展示未脱敏的后端诊断上下文

#### Scenario: 后端日志不翻译

- **WHEN** 后端记录整理目标目录测试、计划生成或执行相关诊断日志
- **THEN** 日志 message MUST 保持英文原文
- **AND** 系统 MUST NOT 为日志 message 添加 Paraglide 翻译
