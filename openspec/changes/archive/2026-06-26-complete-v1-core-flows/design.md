## Context

Renarr V1 当前是一个 SvelteKit 单项目，已经有 SQLite/Drizzle 风格 schema、扫描/计划/执行相关 server services、API routes 和独立 worker。现有实现有可用骨架，但还没有完整落地 `docs/specs/v1.md` 描述的 V1 闭环。

当前主要缺口是跨模块的：

- 前端文案硬编码，没有使用 Paraglide JS。
- 扫描行为没有稳定遵循约定的 `library_items` 状态机。
- 计划创建会直接生成 confirmed plan，用户无法在执行前预览和调整 row。
- item 级整理只是直接“创建计划并提交”，缺少 item detail 和 editable plan draft。
- 手动 TMDB 搜索只是薄接口，不足以覆盖所有 `pending_review` 场景。
- WebDAV test 已有后端雏形，但前端 setup 和 TMDB 连通性测试不完整。
- 错误和日志边界需要稳定：前端按 error code 翻译，后端日志保持英文。

## Goals / Non-Goals

**Goals:**

- 接入 Paraglide JS，提供 `zh-CN` messages，并让普通前端 copy 使用生成的 message 函数。
- 在前端暴露 WebDAV 和 TMDB 连通性测试，使用可靠后端 API。
- 让 `scan_library_path` 和 `scan_library_item` 按 V1 状态规则处理 `unidentified`、`pending_review`、`identified`、`organized`、`failed`。
- 为手动复核和 item 级整理引入持久化 plan draft。
- 允许用户在 worker 执行前预览、选择、调整和提交 rename plan rows。
- 让所有 `pending_review` item 都能手动搜索 TMDB 并指定 identity，包括 no-match 场景。
- 加固 `execute_rename_plan`：执行前校验 source/target、记录文件级执行详情、支持手动 overwrite，并允许部分失败继续执行。

**Non-Goals:**

- 不新增登录或多用户权限系统。
- 不提供 public stable API。
- 不新增下载、字幕下载、播放等媒体能力。
- 不扩展 episode `.nfo`、season poster 或高级 metadata。
- 不泛化到 WebDAV 以外的存储实现。
- V1 不提供 `zh-CN` 以外语言内容，但保留语言切换入口。

## Decisions

1. **使用 Paraglide JS 作为唯一前端 i18n 路径。**

   普通前端 copy 和用户可见 API 错误使用 Paraglide message 函数。后端日志和诊断 message 保持英文。这样后端更稳定，UI 可以独立本地化普通用户反馈。

   备选方案：继续硬编码中文或使用 `svelte-i18n`。硬编码中文违反 V1 规格；`svelte-i18n` 是 runtime store 模型，不如生成式 message 函数贴合当前 SvelteKit 方案。

2. **UI 语言使用浏览器偏好，不进入 SQLite 全局设置。**

   UI language 是浏览器偏好。`namingLanguage` 继续作为 SQLite 全局业务设置，用于 TMDB 请求和命名输出，两者保持独立。

   备选方案：把 UI language 存 SQLite。这样会让所有浏览器共享一个界面语言，并把 UI 偏好和业务设置混在一起。

3. **手动执行前必须有 plan draft。**

   手动整理先创建 `rename_plan_draft`。UI 渲染可编辑 rows，允许选择 row、调整 season/episode、展示冲突和 sidecar，只在用户提交后生成 confirmed `rename_plan`。

   备选方案：从 item card 直接创建并提交。这个路径风险高，因为用户无法检查目标路径或修正映射就会触发 MOVE。

4. **自动和手动执行统一使用 `execute_rename_plan`。**

   worker 只执行 confirmed `rename_plans`，`mode` 记录 plan 来源是 auto 还是 manual。这样避免重复 executor 逻辑。

   备选方案：拆成 `auto_rename` 和 `manual_rename`。这会重复校验、冲突处理、sidecar 移动、metadata 写入和 execution records。

5. **扫描状态流转必须显式且保守。**

   `pending_review` 和 `failed` 在扫描中跳过。`identified` 不再重新识别。`organized` 跳过 TMDB，只更新文件统计并在自动整理开启时处理明确可整理的 non-compliant 文件。`unidentified` 尝试识别并转为 `identified` 或 `pending_review`。

   备选方案：每次扫描刷新所有 item。这样会覆盖用户 review 状态，并产生重复 TMDB/WebDAV 工作。

6. **连通性测试使用命令型 API。**

   WebDAV 和 TMDB 测试是 settings/source UI 调用的显式 POST endpoint，返回稳定成功/失败 DTO，详细诊断写英文日志。

   备选方案：从扫描结果推断连通性。这样设置阶段反馈差，错误也更难定位。

7. **交互式前端数据使用 Svelte Query。**

   Svelte Query 负责轮询、WebDAV browse/test、TMDB search、item detail、plan draft 编辑和任务刷新。query keys 集中定义。

   备选方案：页面里到处手写 `onMount` polling。现有代码已经显示这种方式难以精确 invalidation 和维护。

8. **Folder/item detail 实时读取 WebDAV。**

   `library_items` 不长期保存文件级当前状态，因此 item detail 不能依赖最近一次扫描缓存。detail API 必须按需读取 WebDAV，并把实时文件列表与最近 scan/plan/execution 摘要合并成 DTO。扫描缓存只用于 library path card/list 的快速统计展示。

   备选方案：detail 页只读取最近扫描缓存。这样会让用户在远端文件变化后看到过期数据，也会重新引入长期 `media_files` 表的隐式依赖。

9. **WebDAV 浏览按场景拆分。**

   Library setup 中的 WebDAV browse 只做逐级目录浏览且只显示目录；item detail 中才展示视频、sidecar、metadata 等文件。这样设置阶段保持简单，同时仍能在整理和检查场景中看到真实文件。

   备选方案：setup browse 同时显示文件。这个信息对选择 library root 没有必要，反而会干扰目录选择。

10. **V1 只提供默认深色媒体管理工具风。**

UI 默认深色，使用 shadcn-svelte/Tailwind 语义 tokens 组织颜色，不提供主题切换入口。视觉接近 Sonarr/Radarr 类运维管理工具：深色侧栏、中性深灰主内容、海报墙突出 poster、状态色克制，避免营销式浅色 SaaS dashboard 或大面积彩色渐变。

备选方案：V1 同时做浅色/深色主题。双主题会扩大每个页面、状态色、表格、dialog 和海报占位的 QA 面，当前阶段收益不足。

## Risks / Trade-offs

- **风险：Paraglide 接入会触碰很多前端文件。** → 先迁移 shell、导航、状态、错误文案，再逐页迁移，保持 build 可用。
- **风险：plan draft 增加 schema 和迁移工作。** → 先用窄表加 JSON rows 支持流程，只有必要时再细分结构。
- **风险：detail/preview 和执行之间 WebDAV 状态变化。** → item detail 和 draft 创建读取实时 WebDAV；worker 每个 MOVE 前仍必须重新校验 source 存在和 target 冲突。
- **风险：TMDB 搜索结果可能错误。** → 手动复核始终允许搜索并选择其它 identity；自动 high-confidence 继续保持严格规则。
- **风险：部分失败不易理解。** → execution records 必须文件级记录，task status 必须区分 `partially_failed`，item UI 必须展示最近执行摘要。
- **风险：Svelte Query 和 SvelteKit load 可能重复请求。** → SvelteKit load 只提供稳定首屏上下文，交互/刷新数据交给 Svelte Query，并集中管理 query keys 和 invalidation。

## Migration Plan

1. 增加 Paraglide 配置、messages 和只有 `zh-CN` 的语言偏好 UI。
2. 增加或更新 plan drafts 以及缺失 execution 字段的数据库 schema。
3. 把直接提交的手动整理改为 draft 创建、预览、校验、提交。
4. 修复 scanner 状态处理并增加 `scan_library_item`。
5. 加固 executor 校验、冲突处理、overwrite、sidecar 重查、metadata 和 execution records。
6. 增加 WebDAV 和 TMDB test UI/API。
7. 把交互式前端流程迁移到 Svelte Query，并集中 query keys。
8. 增加 scanner、planner、executor、connectivity services 和 API error mapping 的聚焦测试。

当前仍是 V1 前实现阶段，回滚策略以回退变更分支为主；schema migrations 正式发布前不需要生产数据回滚方案。

## Open Questions

无。具体 UI 布局可以在实现阶段按 spec 约束细化。
