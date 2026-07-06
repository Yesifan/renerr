## ADDED Requirements

### Requirement: Library path 输入提供目录候选

系统 SHALL 在添加 Library path 时提供基于当前 WebDAV source 的目录下拉候选和 autocomplete。候选加载 SHALL 使用只读目录读取，不得创建、移动、删除或改写远端路径。选择候选 SHALL NOT 自动触发 path test。

#### Scenario: 用户编辑 path 输入

- **WHEN** 用户在添加 Library path 的 path 输入框中输入远端路径
- **THEN** UI MUST 根据当前 source 和输入 path 的父目录提供 directory 候选
- **AND** 候选 MUST 只包含直接子目录
- **AND** UI MUST 在前端按已输入 basename 过滤候选
- **AND** UI MUST 只在父目录变化时重新请求候选

#### Scenario: 用户选择目录候选

- **WHEN** 用户从 path 候选中选择一个目录
- **THEN** UI MUST 将输入值更新为该目录的完整远端 path
- **AND** 保存时系统 MUST 仍以用户最终提交的 path 字符串为准
- **AND** 后端 MUST 继续通过既有 path 规范化和可读性测试校验该 path
- **AND** UI MUST NOT 因选择候选而自动触发 path test

#### Scenario: 根目录或空输入候选

- **WHEN** 用户已选择 WebDAV source 但 path 输入为空或为根目录
- **THEN** UI MUST 能加载该 source 根目录下的直接子目录作为候选
- **AND** 系统 MUST NOT 递归加载整棵目录树

#### Scenario: 候选加载失败

- **WHEN** WebDAV source 凭据错误、目录不可读或网络请求失败
- **THEN** UI MUST 展示局部错误状态
- **AND** UI MUST 保留手动输入能力和连接测试入口
- **AND** API 响应和日志 MUST NOT 泄漏 WebDAV 明文凭据

#### Scenario: Source 切换

- **WHEN** 用户切换 path 输入关联的 WebDAV source
- **THEN** UI MUST 清空或重新加载旧 source 的候选状态
- **AND** 后续候选请求 MUST 使用新 source 的 URL 和凭据
- **AND** 系统 MUST NOT 自动把 source URL 拆分或改写为更高层级根地址
