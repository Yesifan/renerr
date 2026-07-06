## MODIFIED Requirements

### Requirement: V1 默认深色媒体管理工具风

系统 SHALL 使用默认深色的媒体管理工具视觉风格，并且 V1 不提供主题切换入口。

#### Scenario: 用户打开应用

- **WHEN** 用户进入 Renarr 前端
- **THEN** UI MUST 默认使用深色主题，并且 MUST NOT 显示主题切换入口

#### Scenario: 页面使用颜色

- **WHEN** 前端页面需要背景、前景、边框、卡片、主色或危险色
- **THEN** 组件 MUST 优先使用 shadcn-svelte/Tailwind 语义 token，而不是在页面中散落硬编码颜色

#### Scenario: 页面使用基础 UI 控件

- **WHEN** 前端页面需要按钮、卡片、dialog、select、switch、checkbox、input、field、table、badge、empty、skeleton 或 sidebar
- **THEN** UI MUST 优先使用已安装或可新增的 shadcn-svelte 组件，而不是自写等价基础控件或使用原生 select

#### Scenario: 页面需要复杂业务控件

- **WHEN** 前端页面需要复杂交互控件
- **AND** shadcn-svelte 没有可用组件或现有组件无法表达业务候选、异步加载、键盘导航、移动端布局或可访问性要求
- **THEN** UI MUST build a project-level custom component
- **AND** the component SHOULD use Bits UI primitives and shadcn/Tailwind semantic tokens
- **AND** implementation MUST NOT modify shadcn base components for one-off visual needs

#### Scenario: 页面需要项目级分区

- **WHEN** 页面需要标题、描述、操作区和内容区组成的管理台 section
- **THEN** UI MAY 使用项目级 `SectionPanel` 封装，但该封装底层 MUST 使用 shadcn Card 组合

#### Scenario: 页面需要模态表单

- **WHEN** 页面需要添加类或确认类模态交互
- **THEN** UI MUST 使用 shadcn Dialog 或业务级 Dialog 组件，并且 MUST NOT 使用通用自写 Modal 壳
