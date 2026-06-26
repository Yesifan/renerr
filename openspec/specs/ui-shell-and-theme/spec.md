## ADDED Requirements

### Requirement: V1 默认深色媒体管理工具风
系统 SHALL 使用默认深色的媒体管理工具视觉风格，并且 V1 不提供主题切换入口。

#### Scenario: 用户打开应用
- **WHEN** 用户进入 Renarr 前端
- **THEN** UI MUST 默认使用深色主题，并且 MUST NOT 显示主题切换入口

#### Scenario: 页面使用颜色
- **WHEN** 前端页面需要背景、前景、边框、卡片、主色或危险色
- **THEN** 组件 MUST 优先使用 shadcn-svelte/Tailwind 语义 token，而不是在页面中散落硬编码颜色

### Requirement: 管理台信息架构
系统 SHALL 使用左侧多级树状导航承载主要信息架构。

#### Scenario: 用户查看导航
- **WHEN** 应用 shell 渲染导航
- **THEN** UI MUST 将 library paths 放在“媒体库”分组下，并将“任务”“日志”“设置”放在“系统”分组下

#### Scenario: 用户查看 library path detail
- **WHEN** 用户打开 library path detail
- **THEN** 主体 MUST 使用海报墙 card 展示 root-level 文件夹和视频文件，并且未识别 item MUST 使用默认占位海报

### Requirement: 状态视觉克制且一致
系统 SHALL 用一致、克制的状态色表达 library item 状态。

#### Scenario: 渲染 item 状态
- **WHEN** UI 展示 `unidentified`、`pending_review`、`identified`、`organized` 或 `failed` 状态
- **THEN** UI MUST 使用稳定状态色映射：未识别为灰，待确认为黄/橙，已识别为蓝，已整理为绿，失败为红

#### Scenario: 普通操作文案
- **WHEN** UI 展示常用按钮、toast 或表格状态
- **THEN** 中文文案 MUST 简短且工具化，例如“扫描”“整理”“待处理”“查看计划”“手动指定”
