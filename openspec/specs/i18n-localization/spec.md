## Purpose

定义 Renarr 前端用户可见文案、本地化错误和诊断日志的语言边界，确保 UI 使用 Paraglide messages，同时后端诊断保持稳定英文。

## Requirements

### Requirement: 前端文案使用 Paraglide messages

系统 SHALL 使用 `@inlang/paraglide-js` 管理普通前端用户可见文案，V1 唯一 locale 为 `zh-CN`。

#### Scenario: 页面渲染翻译后的导航

- **WHEN** 用户打开应用 shell
- **THEN** 导航标签 MUST 通过 Paraglide message 函数渲染，而不是页面内硬编码字符串

#### Scenario: 状态标签被翻译

- **WHEN** library item 具有 `pending_review` 或 `organized` 等稳定后端状态
- **THEN** 前端 MUST 使用 Paraglide messages 显示对应中文标签

### Requirement: 浏览器语言偏好

系统 SHALL 将 UI 语言保存为浏览器级偏好，并且 MUST NOT 将 UI 语言保存到 SQLite 全局设置。

#### Scenario: 用户选择语言

- **WHEN** 用户选择可用的 `zh-CN` 语言选项
- **THEN** 系统 MUST 更新浏览器偏好，并且不修改 SQLite 中的应用设置

#### Scenario: 应用没有语言偏好时加载

- **WHEN** 不存在浏览器语言偏好
- **THEN** 前端 MUST 使用 `zh-CN`

### Requirement: 业务命名语言保持独立

系统 SHALL 将 UI language 与全局 `namingLanguage` 业务设置分离。

#### Scenario: UI 语言变化

- **WHEN** 浏览器 UI 语言偏好被修改
- **THEN** TMDB 请求语言和命名模板输出 MUST 继续使用已配置的 `namingLanguage`

### Requirement: 前端错误按 code 本地化

系统 SHALL 返回稳定 API error code，前端 SHALL 将已知用户可见错误翻译为中文。

#### Scenario: 已知 API 错误

- **WHEN** API 响应包含已知 error code，例如 `webdav.connection_failed`
- **THEN** 普通 UI 错误区域 MUST 显示中文翻译消息

#### Scenario: 未知 API 错误

- **WHEN** API 响应包含未知 error code
- **THEN** UI MUST 显示安全 fallback 消息，并且不能暴露敏感上下文

### Requirement: 日志保持英文诊断

系统 SHALL 保持后端 log message 和 diagnostic context 为英文，任务详情 SHALL 原样展示持久化的 task detail lines。

#### Scenario: 用户查看任务运行记录

- **WHEN** 用户打开系统任务详情
- **THEN** 运行记录 MUST 展示后端英文 task detail `message` 和 `level`，并且不翻译 message body

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
