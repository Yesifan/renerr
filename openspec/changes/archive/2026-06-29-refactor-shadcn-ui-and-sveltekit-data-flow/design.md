## Context

Renarr 是单仓 SvelteKit 全栈应用，前端使用 Svelte 5、Tailwind CSS、shadcn-svelte、Svelte Query 和 Paraglide，后端业务逻辑集中在 `$lib/server/services`。V1 已经有深色管理台风格、左侧树状导航、媒体库海报墙、设置页、系统任务/日志页和一组 JSON API。

当前实现存在两个横向问题：

- UI 层只部分使用 shadcn-svelte。`button` 和 `card` 已经存在，但 shell/sidebar、modal、section panel、select、switch、table、form field、badge、empty/skeleton 等仍混用自写 markup 和原生控件。
- 数据流层过度依赖客户端 `fetch('/api/workspace')` 和巨型 `Workspace` DTO。页面首屏 SSR、页面表单提交、高交互 API、轮询和 server services 的边界不够清晰。

本变更采用多阶段重构，先统一 UI 基础，再拆分 API/data boundaries。重构必须保持 V1 业务规则：添加类操作使用 dialog 承载，修改类操作保留在原位置内联编辑并有明确保存，二值可操作设置必须真实持久化，WebDAV/TMDB/settings 的敏感字段规则不退化。

## Goals / Non-Goals

**Goals:**

- 优先使用 shadcn-svelte 组件替换所有可以由 shadcn 表达的 UI 控件和结构。
- 保留有业务语义的项目封装，尤其 `SectionPanel`，但底层改用 shadcn 组合。
- 删除通用 `Modal` 封装，页面直接组合 shadcn Dialog，必要时抽业务级 dialog 组件。
- 将复杂页面按业务区域拆分成页面级组件，页面继续持有业务状态和 mutation，子组件偏展示和事件回调。
- 将页面首屏数据迁移到 `+page.server.ts`/`+layout.server.ts load`，将设置页保存/添加迁移到 actions。
- 拆分 `/api/workspace` 和 `src/lib/client/api.ts` 的职责，形成窄 DTO、窄 API、共享 schema/type 和独立 UI formatter。
- 保留 Svelte Query 用于轮询、懒加载详情、TMDB 搜索和 rename draft 行内更新。

**Non-Goals:**

- 不在本变更中改变媒体扫描、整理计划、WebDAV 执行、TMDB 识别等核心业务语义。
- 不做全站 i18n 补齐，只在触碰 UI 时复用现有 messages 或保持 V1 中文文案。
- 不主动重命名 URL；已有旧 URL 继续使用 redirect，只有发现重复维护入口时才调整。
- 不把所有 JSON API 机械迁移到 actions。高交互工作台和测试/浏览类操作继续使用窄 JSON API。
- 不刷新或覆盖已安装的 shadcn `button`、`card` 组件，除非后续明确需要并单独确认。

## Decisions

1. **shadcn 缺失组件只新增，不覆盖已有组件。**

   第一阶段通过 shadcn CLI 新增缺失组件，例如 Dialog、Select、Switch、Checkbox、Input、Field、Table、Badge、Empty、Skeleton、Sidebar。已有 `button` 和 `card` 不执行 `update --all` 或 `--overwrite`，避免引入无关视觉/API 变化。

   备选方案：一次性更新全部 shadcn 组件。该方案可能覆盖已有本地调整，且会把 registry 变化与本次重构混在一起。

2. **`SectionPanel` 保留，`Modal` 删除。**

   `SectionPanel` 表达 Renarr 设置页和管理页的业务分区，保留能减少重复并统一 section 密度；其内部改用 shadcn Card 组合。通用 `Modal` 过浅，容易变成参数膨胀的壳；添加媒体源、添加 Library Path 等页面直接使用 Dialog，后续只抽业务级 dialog。

   备选方案：所有页面直接手写 Card/Dialog。这样会增加重复，并让后续统一管理台 section 风格更困难。

3. **所有原生 select 替换为 shadcn Select。**

   包括 settings/media 里的命名语言、媒体源、媒体类型，以及 AppShell 顶部语言选择。后续新增选择器默认不使用原生 `<select>`，除非 shadcn 组件无法满足明确的浏览器能力需求。

   备选方案：顶部语言选择暂留原生控件。用户已明确要求全替换；保留会留下不一致的交互和视觉。

4. **二值控件按语义区分 Switch 和 Checkbox。**

   已存在对象的立即生效设置使用 Switch，例如 Library Path 列表中的 `autoOrganize`。表单提交前的选择项、批量行选择和冲突 overwrite 选择使用 Checkbox，例如添加 Library Path 的初始 `autoOrganize`、rename draft row `selected` 和覆盖选择。

   备选方案：所有二值控件统一 Switch。这样会把“设置开关”和“选择项”混在一起，降低表单语义清晰度。

5. **页面级组件拆分按业务区域进行。**

   `settings/media` 拆为元数据设置、文件管理设置、Library Paths table、Sources table、添加 Library Path dialog、添加 Source dialog。`libraries/[id]` 拆为 item grid/card、manual match、item detail、rename plan panel。`AppShell` 拆为 TopBar 和 SidebarNav。页面组件继续持有业务状态、query 和 mutation，子组件通过 props/callback 协作。

   备选方案：组件内部自行持有 query/mutation。这样会让数据流分散，后续迁移 load/actions 更难追踪。

6. **数据边界采用 load/actions/API/Svelte Query 混合模型。**

   首屏可 SSR 的页面数据走 server load；设置页保存/添加走 actions；测试连接、WebDAV browse、媒体库详情页高交互流程走职责专一 JSON API；Svelte Query 只用于轮询、懒加载和高交互 mutation。

   备选方案：所有操作都改为 `/api/**` 或所有操作都改为 actions。前者丢失 SvelteKit 全栈优势，后者不适合媒体库详情页这种高交互工作台。

7. **拆分 `/api/workspace`，不保留巨型聚合接口作为长期边界。**

   Shell 首屏导航数据由 root layout server load 提供。动态摘要按职责拆成窄接口，例如 navigation libraries 或 tasks summary。页面首屏不再依赖 `/api/workspace`。迁移期间可短期保留旧接口，前端迁完后删除。

   备选方案：保留 `/api/workspace` 但瘦身。该方案仍会鼓励页面复用聚合 DTO，和职责专一目标冲突。

8. **共享类型、schema、fetch helper 和 UI formatter 分离。**

   `src/lib/client/api.ts` 最终只保留 fetch helper 和客户端错误处理。共享 DTO/schema 放到 `$lib/schemas` 或按领域拆分；`libraryLabel`、`statusText`、`statusClass` 等 UI helper 迁到 client formatter/view-model 模块。

   备选方案：继续在 `api.ts` 堆类型和 formatter。API 拆分后该文件会成为新的聚合中心。

9. **新增/改动的写接口、actions 和 query 参数必须用 Zod schema 校验。**

   route/action 读取输入、schema parse、调用 service、映射 ApiError。service 仍对关键业务规则做防御，尤其 settings 的 masked TMDB key、局部更新、WebDAV URL 原样保存等规则。

   备选方案：依赖 TypeScript 类型和手写 if。运行时输入来自 HTTP/form，必须有统一解析边界。

## Risks / Trade-offs

- **风险：shadcn CLI 或 registry 网络失败。** → 使用项目 AGENTS 中记录的去代理命令重试，只新增缺失组件，不覆盖已有组件。
- **风险：UI 替换引入行为回归。** → 按页面分批替换，先 settings/media，再 libraries/[id]，再系统页/首页，最后 AppShell Sidebar；每阶段运行 check/test/build 并做浏览器 smoke test。
- **风险：Dialog/Select/Switch 的绑定 API 与原生控件不同。** → 以安装后的组件 barrel 和文档为准，迁移后用 Svelte autofixer 和浏览器交互验证。
- **风险：load/actions 与 Svelte Query 重复请求。** → load 只提供首屏稳定数据，后续轮询和高交互数据由 Svelte Query 接管；query invalidation 只作用于需要局部刷新的数据。
- **风险：API 拆分期间同时存在旧接口和新接口。** → 每阶段明确迁移调用点，前端不再引用 `/api/workspace` 后再删除旧 endpoint。
- **风险：组件拆分增加文件数量。** → 只按业务区域拆分，不按每个 card/table row 机械拆分。

## Migration Plan

1. 新增缺失 shadcn 组件，检查组件文件和 barrel exports。
2. 将 `SectionPanel` 改为 shadcn Card 封装，逐步删除 `Modal` 并迁移到页面 Dialog。
3. 重构 `settings/media`：替换表单控件、Select、Switch/Checkbox、Table、Badge/Empty，并拆分页面级组件。
4. 重构 `libraries/[id]`：替换状态 badge、表格、checkbox/input、空状态和相关面板组件，保留 Svelte Query 高交互模型。
5. 重构系统页、首页和 AppShell：使用 shadcn Sidebar、Select、Table/Empty，并从 layout server load 获取首屏导航数据。
6. 拆分 `api.ts` 的 DTO/schema/formatter 职责，并引入窄读取接口和 Zod 输入 schema。
7. 为首页、设置页、系统页增加 server load；为设置保存/添加增加 actions；测试/浏览和媒体库详情高交互 API 保持 JSON API。
8. 迁移前端调用点后删除 `/api/workspace` 或将其替换为窄 navigation endpoint。
9. 每个阶段运行 `pnpm run check`、`pnpm test`、`pnpm build`、`pnpm run build:worker`；Svelte 组件编辑后使用 Svelte autofixer。

当前项目尚未发布稳定外部 API，回滚策略以回退对应重构阶段提交为主。若某阶段风险过高，可以保留旧页面数据流并只完成 UI 替换。

## Open Questions

无。实现阶段如发现某个 shadcn 组件与现有交互不兼容，优先使用 shadcn 组合方式解决；无法解决时再引入项目级业务封装。
