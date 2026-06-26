## ADDED Requirements

### Requirement: WebDAV 连接测试
系统 SHALL 提供前端可调用的 WebDAV 连接测试，只验证认证和目录读取。

#### Scenario: 来源测试成功
- **WHEN** 用户使用有效 URL 和凭据测试 WebDAV source
- **THEN** 系统 MUST 执行只读 list 操作并返回成功结果，且不能创建、移动或删除远端文件

#### Scenario: 来源测试失败
- **WHEN** WebDAV 服务拒绝请求或无法连接
- **THEN** 前端 MUST 显示本地化失败消息，后端 MUST 写入英文诊断日志

### Requirement: WebDAV library path 测试
系统 SHALL 支持测试已配置或候选 library path 是否可读。

#### Scenario: Library path 可读
- **WHEN** 用户测试存在且可 list 的路径
- **THEN** 系统 MUST 返回成功，并且 MUST NOT 声称已验证写权限

#### Scenario: Library path 不可读
- **WHEN** 路径不存在或无法 list
- **THEN** 系统 MUST 返回稳定 error code，并且 MUST NOT 在测试中创建该路径

### Requirement: TMDB 连通性测试
系统 SHALL 使用已配置或当前提交的 API key 提供前端可调用的 TMDB 连通性测试。

#### Scenario: TMDB 测试成功
- **WHEN** 用户测试有效 TMDB API key
- **THEN** 系统 MUST 验证 TMDB API 可访问并返回成功，且不能暴露完整 API key

#### Scenario: TMDB 测试失败
- **WHEN** TMDB 返回 401、403、429、timeout 或网络错误
- **THEN** 系统 MUST 返回稳定 error code，并写入包含脱敏上下文的英文诊断日志

### Requirement: 设置 UI 提供连通性测试
系统 SHALL 在相关 settings/source UI 暴露 WebDAV 和 TMDB 测试入口。

#### Scenario: 用户配置 source
- **WHEN** 用户创建或编辑 WebDAV source
- **THEN** UI MUST 提供连接测试，并可使用新输入凭据或已保存凭据

#### Scenario: 用户配置 TMDB key
- **WHEN** 用户编辑媒体设置
- **THEN** UI MUST 为当前输入 key 或已保存 key 提供 TMDB 测试动作

### Requirement: WebDAV 浏览按场景展示内容
系统 SHALL 在不同 WebDAV 浏览场景中展示不同类型的远端条目。

#### Scenario: Library setup 浏览
- **WHEN** 用户在 library setup 中浏览 WebDAV 路径
- **THEN** UI MUST 只展示目录，并且 MUST NOT 展示普通文件

#### Scenario: Library setup 逐级浏览
- **WHEN** 用户进入 WebDAV 子目录
- **THEN** 系统 MUST 只读取当前目录的直接子目录，并且 MUST NOT 递归加载整棵目录树

#### Scenario: Item detail 浏览
- **WHEN** 用户打开 library item detail
- **THEN** UI MUST 展示该 item 下的目录、视频文件、sidecar 文件和 metadata 文件

### Requirement: 后端出站请求遵循代理环境变量
系统 SHALL 在 web 与 worker 进程启动时自动根据 `HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY`（含小写变体）配置出站 HTTP dispatcher，使内置 `fetch` 的 TMDB 调用走系统代理。

#### Scenario: 环境配置了代理
- **WHEN** 进程启动时存在任一代理环境变量
- **THEN** 系统 MUST 在首次出站请求前设置全局 dispatcher，且 MUST 在 web 与 worker 两条启动链路都生效
- **AND** TMDB 连通性测试、识别搜索等出站调用 MUST 经由该代理完成，且 MUST NOT 因内置 `fetch` 不读环境变量而直接超时

#### Scenario: 未配置代理
- **WHEN** 进程启动时不存在任何代理环境变量
- **THEN** 系统 MUST 保持默认直连行为，且 MUST NOT 引入额外副作用

### Requirement: 测试不能泄漏 secret
系统 SHALL 防止凭据、token 和完整 TMDB key 出现在 API 响应或日志中。

#### Scenario: 带 secret 的连接测试失败
- **WHEN** 连通性测试失败
- **THEN** 日志和 API 响应 MUST 省略 WebDAV 明文凭据和完整 TMDB API key
