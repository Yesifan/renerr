# V1 Product Decisions

## 核心实现文件索引

- WebDAV 客户端：`src/lib/server/integrations/webdav-client.ts`
- 扫描与 item 统计：`src/lib/server/services/scanner.ts`
- 整理计划生成：`src/lib/server/services/planner.ts`
- 整理计划执行：`src/lib/server/services/executor.ts`
- 文件名解析：`src/lib/server/services/parser.ts`
- 文件合规判断：`src/lib/server/services/compliance.ts`
- 媒体库 item/detail 服务：`src/lib/server/services/items.ts`
- WebDAV/TMDB/source/settings 服务：`src/lib/server/services/sources.ts`、`src/lib/server/services/tmdb.ts`、`src/lib/server/services/settings.ts`
- Worker 入口：`src/worker/index.ts`
- 媒体库主界面：`src/routes/libraries/[id]/+page.svelte`
- V1 回归测试：`src/lib/server/services/v1-core-flows.test.ts`、`src/lib/server/integrations/webdav-client.test.ts`

## 产品决策

- 单仓单 SvelteKit app，保留 worker 独立入口，由 web 主进程负责 worker 生命周期。
- 前端使用 Svelte 5、TypeScript、Tailwind CSS、shadcn-svelte、Svelte Query、Paraglide。
- i18n 使用 `@inlang/paraglide-js`，V1 只配置 `zh-CN`；UI 语言是浏览器偏好，不写入 SQLite。
- 后端、worker、日志 message 使用英文原文；普通 UI 错误通过 error code 翻译成中文。
- 默认深色媒体管理工具风格，无主题切换入口；状态色保持克制。
- 左侧使用多级树状导航：媒体库 path、系统任务和设置；当前不提供独立全局日志页，任务运行记录在任务详情中展示。
- WebDAV library setup 浏览器只显示目录；item detail 展示媒体身份、海报、完整远端路径和扫描统计，不展示实时文件列表；创建 rename plan draft 时才实时读取 WebDAV 文件。
- TV/Movie library detail 都只展示顶级目录中的视频文件和文件夹；TV 海报墙按一级剧集文件夹展示。
- 数据库记录一级 `library_items` 的身份、状态和统计；不长期保存内部视频文件表。
- `organized` 表示一级文件夹已匹配 identity，不要求内部文件全部符合当前命名模板；通过 non-compliant count 提示"有待整理文件"。
- `organized` item 不提供手动指定入口；是否需要执行计划由 item 的待整理统计和 planner 的完整 source/target path 比较共同决定。
- 顶级单文件整理后视为原 file item 删除、新 folder item 新建，不做 file -> folder 身份转换。
- 扫描以远端一级目录为事实来源，同步 `library_items`，消失的 item 硬删除。
- TMDB 请求需要支持环境变量代理。
- 后台任务类型保持：`scan_library_path`、`scan_library_item`、`create_rename_plan_for_item`、`execute_rename_plan`；未实现的能力记录在 `docs/future-work.md`，不得写入当前任务类型列表。

## 连通性测试

设置页提供：

- WebDAV source 连接测试，只验证认证和根目录 list，不写远端文件。
- Library path 可读测试，只验证指定路径可 list。
- TMDB 连通性测试，支持当前输入 key 或已保存 key。

TMDB API base URL 可通过环境变量覆盖，用于代理：

```sh
RENARR_TMDB_BASE_URL=https://your-proxy.example.com/3
```
