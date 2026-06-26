# Renarr

Renarr 是深色管理台风格的 WebDAV 媒体库整理工具。V1 使用 SvelteKit 全栈单项目、TypeScript、Tailwind CSS、shadcn-svelte、SQLite、Drizzle 风格 schema、Zod、Svelte Query 和 Paraglide JS。

## 开发

安装依赖后启动 Web：

```sh
pnpm dev
```

启动 worker：

```sh
pnpm dev:worker
```

常用验证：

```sh
pnpm run check
pnpm test
pnpm build
pnpm run build:worker
```

## i18n

前端普通 UI 文案使用 `@inlang/paraglide-js`，V1 只配置 `zh-CN`。语言偏好是浏览器级偏好，保存在 Paraglide runtime 的浏览器策略中，不写入 SQLite。

主要文件：

- `project.inlang/settings.json`
- `messages/zh-CN.json`
- `src/lib/i18n.ts`
- `src/lib/paraglide/`

后端和 worker 的日志 message 保持英文。普通 UI 错误通过 API error `code` 映射成中文。

## 连通性测试

设置页提供：

- WebDAV source 连接测试，只验证认证和根目录 list，不写远端文件。
- Library path 可读测试，只验证指定路径可 list。
- TMDB 连通性测试，支持当前输入 key 或已保存 key。

TMDB API base URL 可通过环境变量覆盖，用于代理：

```sh
RENARR_TMDB_BASE_URL=https://your-proxy.example.com/3
```

## 整理流程

自动和手动整理最终都进入 `execute_rename_plan` task。

手动整理流程：

1. 用户在 library item detail 中查看实时 WebDAV 文件列表。
2. 对 `identified` 或 `organized` item 创建 plan draft。
3. 前端展示 rows，允许选择/取消、调整 TV season/episode、处理冲突。
4. 提交 draft 后创建 confirmed `rename_plan(mode='manual')`。
5. worker 执行 `execute_rename_plan`，逐文件校验 source/target，移动视频和 sidecar，写 metadata 和 execution records。

扫描任务：

- `scan_library_path`
- `scan_library_item`
- `execute_rename_plan`
