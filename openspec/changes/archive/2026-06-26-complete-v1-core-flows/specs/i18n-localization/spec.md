## ADDED Requirements

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

系统 SHALL 保持后端 log message 和 diagnostic context 为英文，日志页 SHALL 展示这些原始消息。

#### Scenario: 用户查看日志

- **WHEN** 用户打开系统日志页
- **THEN** 日志行 MUST 展示后端英文 `message`、`component`、`level` 和 `contextJson`，并且不翻译 message body
