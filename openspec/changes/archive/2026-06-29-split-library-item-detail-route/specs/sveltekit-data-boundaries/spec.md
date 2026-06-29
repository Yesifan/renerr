## MODIFIED Requirements

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
- **THEN** 页面 MUST 使用 route 参数加载当前 library path 和 item 的初始上下文，并使用职责专一 JSON API 获取实时 item detail 和执行 item 级操作

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
