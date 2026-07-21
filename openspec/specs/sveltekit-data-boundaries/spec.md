## Purpose

定义 Renarr SvelteKit 全栈边界：稳定首屏数据优先使用 server load，页面表单写入优先使用 actions，高交互与轮询保留职责专一 JSON API。

## Requirements

### Requirement: 页面首屏数据使用 server load

系统 SHALL 对不需要持续客户端轮询的页面首屏数据使用 SvelteKit server load 直接调用 `$lib/server/services`。

#### Scenario: 用户打开首页

- **WHEN** 用户进入媒体库首页
- **THEN** 页面首屏数据 MUST 由 `+page.server.ts` 或父级 server load 获取，并且 MUST NOT 依赖组件 `onMount` 后再请求聚合 workspace API 才显示主要内容

#### Scenario: 用户打开设置页

- **WHEN** 用户进入媒体管理设置页
- **THEN** settings、sources 和 library paths 的初始数据 MUST 由 server load 调用对应 service 获取

### Requirement: 页面表单写入使用 actions

系统 SHALL 对设置页中的保存和添加类页面表单写入使用 SvelteKit form actions。

#### Scenario: 用户保存设置

- **WHEN** 用户提交 TMDB 设置或文件管理设置
- **THEN** 页面 MUST 通过 `+page.server.ts` action 调用 settings service 保存局部更新

#### Scenario: 用户添加管理对象

- **WHEN** 用户在 dialog 中添加媒体源或 Library Path
- **THEN** 页面 MUST 通过 SvelteKit action 创建对象，并且添加表单 MUST 继续由 dialog 承载

### Requirement: 高交互流程使用职责专一 JSON API

系统 SHALL 保留 JSON API 用于测试、浏览、轮询、懒加载详情和媒体库详情页高交互操作，并且每个 API MUST 只表达单一职责。

#### Scenario: 用户测试连接

- **WHEN** 用户点击 TMDB、WebDAV source 或 Library Path 的测试按钮
- **THEN** 前端 MUST 调用对应测试 API，而不是提交保存 action 或调用聚合 workspace API

#### Scenario: 用户操作媒体库详情页

- **WHEN** 用户扫描 item、搜索 TMDB、指定 identity、创建/编辑/提交 rename plan draft 或加载 item detail
- **THEN** 前端 MAY 使用职责专一 JSON API 和 Svelte Query 进行局部刷新

#### Scenario: 用户打开 item detail URL

- **WHEN** 用户直接访问 `libraries/[id]/[item_id]`
- **THEN** 页面 MUST 使用 route 参数加载当前 library path 和 item 摘要上下文，并使用职责专一 JSON API 获取 active task、TMDB 搜索、rename plan draft 和执行 item 级操作
- **AND** 页面 MUST NOT 为默认详情页加载实时 WebDAV 文件列表

### Requirement: Svelte Query 限定于动态交互数据

系统 SHALL 将 TanStack Svelte Query 限定用于轮询、懒加载详情、客户端高交互 mutation 和局部 invalidation。

#### Scenario: 页面只需要首屏稳定数据

- **WHEN** 页面数据不需要持续刷新或用户选择后懒加载
- **THEN** 页面 MUST NOT 为该首屏数据新增 Svelte Query 请求

#### Scenario: 页面需要动态刷新

- **WHEN** 任务列表、日志、媒体库 item 列表或 item detail 需要轮询或局部刷新
- **THEN** 页面 MAY 使用 Svelte Query，并且 query keys MUST 集中定义

#### Scenario: library path 列表刷新

- **WHEN** 用户停留在 `libraries/[id]`
- **THEN** 页面 MAY 使用 Svelte Query 轮询 item 列表，但 MUST NOT 查询或缓存未打开 item 的 detail、manual match 或 rename plan draft

#### Scenario: item detail 局部刷新

- **WHEN** 用户停留在 `libraries/[id]/[item_id]`
- **THEN** 页面 MAY 使用 Svelte Query 管理当前 item detail、manual match mutation 和 rename plan draft，并在成功 mutation 后 invalidate 当前 item、library item 列表、libraries 和 tasks 的相关 query keys

### Requirement: 聚合 workspace API 被拆分

系统 SHALL 拆分 `/api/workspace` 的职责，长期边界 MUST 使用 server load 或职责专一 API 返回窄 DTO。当前不存在 `/api/workspace` 聚合 API。

#### Scenario: AppShell 渲染导航

- **WHEN** 应用 shell 首次渲染左侧导航
- **THEN** 初始导航数据 MUST 来自 root layout server load，而不是客户端挂载后请求 `/api/workspace`

#### Scenario: 页面获取领域数据

- **WHEN** 页面需要 sources、libraries、items、tasks、logs 或 settings
- **THEN** 页面 MUST 使用对应 service/load/action/API 边界获取数据，并且 MUST NOT 通过巨型 workspace DTO 获取无关领域数据

### Requirement: HTTP 输入使用 schema 校验

系统 SHALL 对新增或改动的 actions、写接口和 query 参数使用 Zod schema 或等效共享 schema 进行运行时校验。

#### Scenario: 写接口接收请求

- **WHEN** route action 或 JSON API 接收 form data、JSON body 或 query string
- **THEN** 路由层 MUST 先解析并校验输入，再调用 server service

#### Scenario: 设置保存包含敏感字段

- **WHEN** 用户保存 settings patch 且未提交新的 TMDB API key
- **THEN** schema 和 service MUST 支持局部更新，并且 MUST NOT 将 masked key 写回真实配置

### Requirement: 客户端 API helper 职责单一

系统 SHALL 将 fetch helper、共享 DTO/schema 和 UI formatter 分离，避免 `src/lib/client/api.ts` 成为聚合模块。

#### Scenario: 前端调用 API

- **WHEN** 客户端代码需要执行 JSON API 请求
- **THEN** 它 MUST 通过 fetch helper 处理响应和 API error DTO，但领域 DTO 类型 SHOULD 来自共享 schema/type 模块

#### Scenario: 前端渲染状态样式

- **WHEN** UI 需要渲染 library label 或状态样式
- **THEN** 页面 MUST 使用 client formatter/view-model 模块，而不是从 fetch helper 模块导入 UI helper
