## 1. shadcn 组件基础

- [x] 1.1 审计 `components.json` 和 `src/lib/components/ui/**`，确认已安装组件和 barrel exports
- [x] 1.2 使用 shadcn CLI 只新增缺失组件，不覆盖已有 `button` 和 `card`
- [x] 1.3 读取新增组件文件，确认 Dialog、Select、Switch、Checkbox、Input、Field、Table、Badge、Empty、Skeleton、Sidebar 的导入和组合 API
- [x] 1.4 对新增组件运行 `pnpm run check`，修复安装后类型或 import 问题

## 2. 设置页 shadcn 化

- [x] 2.1 将 `SectionPanel` 改为 shadcn Card 底层实现，保留现有 title、description、actions、children 语义
- [x] 2.2 删除 `Modal` 使用点，将添加 Library Path 和添加媒体源改为页面内 shadcn Dialog
- [x] 2.3 将 settings/media 的 input、select、checkbox、switch、table、badge/empty 等 UI 替换为 shadcn 组件
- [x] 2.4 按业务区域拆分 settings/media 组件：元数据设置、文件管理设置、Library Paths、Sources、添加 dialog
- [x] 2.5 保持页面持有 dialog open、busy、message 和业务回调，子组件通过 props/callback 或表单提交触发操作
- [x] 2.6 使用 Svelte autofixer 检查新增或修改的 `.svelte` 文件，并修复反馈的问题

## 3. 媒体库详情页 shadcn 化

- [x] 3.1 将 item card 状态标签替换为 shadcn Badge，并保持现有状态色映射
- [x] 3.2 将 item detail、文件列表和 rename plan table 替换为 shadcn Table/Input/Checkbox/Button 等组合
- [x] 3.3 将手动 TMDB 搜索、manual match 和整理计划面板按业务区域拆分组件
- [x] 3.4 保留媒体库详情页现有 Svelte Query 高交互模型、query keys 和 mutation invalidation
- [x] 3.5 对行内 season/episode、selected、conflictAction 编辑做浏览器 smoke test
- [x] 3.6 使用 Svelte autofixer 检查新增或修改的 `.svelte` 文件，并修复反馈的问题

## 4. Shell、首页和系统页 shadcn 化

- [x] 4.1 使用 shadcn Sidebar 重构 AppShell 左侧多级树导航，保留当前媒体库、设置、系统 IA
- [x] 4.2 将顶部语言选择替换为 shadcn Select，并保持浏览器语言偏好更新行为
- [x] 4.3 将首页媒体库列表、空状态和状态摘要改为 shadcn Card/Badge/Empty 等组件
- [x] 4.4 将系统任务和日志页的 SectionPanel/table/empty/loading UI 替换为 shadcn 组件
- [x] 4.5 检查桌面和移动端布局，确保文本不溢出、控件不重叠、侧栏导航可用
- [x] 4.6 使用 Svelte autofixer 检查新增或修改的 `.svelte` 文件，并修复反馈的问题

## 5. 类型、schema 和客户端 helper 拆分

- [x] 5.1 将 `src/lib/client/api.ts` 中的领域 DTO 类型迁移到共享 schema/type 模块
- [x] 5.2 将 `libraryLabel`、`statusText`、`statusClass` 等 UI helper 迁移到 client formatter/view-model 模块
- [x] 5.3 保留 `api.ts` 的 fetch helper、API error DTO 解析和客户端错误类职责
- [x] 5.4 为 settings、sources、libraries、library items、navigation 等新增或改动输入定义 Zod schema
- [x] 5.5 更新所有 import，确保前端不再从 fetch helper 模块导入领域类型或 UI helper

## 6. SvelteKit load/actions 和 API 拆分

- [x] 6.1 新增 root `+layout.server.ts`，为 AppShell 提供首屏导航所需 library path 数据
- [x] 6.2 将首页首屏数据迁移到 `+page.server.ts load`，直接调用 server services 获取 libraries 和 item counts
- [x] 6.3 将 settings/media 首屏数据迁移到 `+page.server.ts load`，直接调用 settings/sources services
- [x] 6.4 将设置保存、添加媒体源、添加 Library Path 迁移到 SvelteKit actions，并使用 schema 校验输入
- [x] 6.5 保留 TMDB/WebDAV 测试、WebDAV browse、媒体库详情高交互流程为职责专一 JSON API
- [x] 6.6 为媒体库详情页提供必要首屏 `library` 和初始 `items` load，同时保留后续轮询/懒加载 Svelte Query
- [x] 6.7 拆分 `/api/workspace` 调用点，迁移完成后删除旧 endpoint 或替换为窄 navigation endpoint

## 7. 测试与验证

- [x] 7.1 为 settings masked TMDB key、局部更新、source URL 原样保存和 autoOrganize 持久化补充或更新测试
- [x] 7.2 为新增/改动的 schema parse、actions 和窄 API 错误路径补充测试
- [x] 7.3 运行 `pnpm run check`
- [x] 7.4 运行 `pnpm test`
- [x] 7.5 运行 `pnpm build`
- [x] 7.6 运行 `pnpm run build:worker`
- [x] 7.7 启动本地 web/worker，对 Dialog、Select、Switch、settings actions、媒体库详情高交互和 sidebar 导航做 smoke test
