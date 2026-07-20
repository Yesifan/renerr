# <img src="static/icon.svg" alt="" width="28" style="vertical-align: -6px"> Renarr

Renarr 是深色管理台风格的 WebDAV 媒体库整理工具。V1 使用 SvelteKit 全栈单项目、TypeScript、Tailwind CSS、shadcn-svelte、SQLite、Drizzle ORM、Zod、Svelte Query 和 Paraglide JS。

![Library detail](static/screenshots/library-detail.png)

## 项目状态

Renarr 当前是开发中的 beta 版本。在标记为正式发布版本前，数据库和 API 不承诺无损升级或向后兼容；开发期间 schema/API 变化可以要求重建本地 SQLite 数据库。

准备创建正式 release tag 前，需要先更新这段 beta 描述，并重新确认数据库/API 的兼容策略。

## 数据库

数据库结构以 `src/lib/server/db/schema.ts` 为唯一真实来源。beta 阶段不维护已提交的迁移历史，开发者在 schema 变化后运行：

```sh
pnpm run db:push
```

如果开发期旧 SQLite 数据库与当前 schema 不兼容，直接重建数据库后重新运行 `db:push`。正式发布前再切换到 `db:generate`/`db:migrate` 流程；届时生成的根目录 `drizzle/` migration artifacts 需要纳入 git 管理，并重新确认兼容策略。

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

item 状态规则：

- `pending_review` 表示需要用户确认身份，可以有 TMDB 候选，也可以没有候选。
- 识别失败不再使用 item status `failed`；beta 阶段不兼容旧 `failed` item，旧开发库不匹配时重建数据库。
- 重命名执行失败只记录在任务、日志、execution records 和执行摘要中，不修改 item status。

手动指定流程：

1. 用户在 item detail 点击“手动指定”。
2. Dialog 优先展示扫描候选，同时支持 TMDB 搜索。
3. 用户选择结果后保存 item identity，并直接进入 rename plan draft 编辑。

执行计划流程：

1. 对 `identified` item，或包含待整理文件的 `organized` item 创建 plan draft。
2. 创建 draft 时实时读取 WebDAV 文件；item detail 页面本身不展示实时文件列表。
3. 前端展示可编辑 rows，允许选择/取消、调整 TV season/episode、行级 TMDB 选择、处理冲突。
4. 最终确认页以目标完整路径为主，不使用可编辑 table。
5. 提交 draft 后创建 confirmed `rename_plan(mode='manual')`。
6. worker 执行 `execute_rename_plan`，逐文件校验 source/target，移动视频和 sidecar，写 metadata 和 execution records。

后台任务：

- `scan_library_path`
- `scan_library_item`
- `execute_rename_plan`
- `cleanup_invalid_dirs`

## Docker

构建镜像：

```sh
docker compose build
```

首次运行前需要生成一个 32 字节的 base64 secret key：

```sh
openssl rand -base64 32
```

启动（同时运行 web server 和 worker）：

```sh
RENARR_SECRET_KEY=<your-key> docker compose up -d
```

或者将 key 写入 `.env` 文件：

```
RENARR_SECRET_KEY=<your-key>
```

然后直接 `docker compose up -d`。

默认监听 `localhost:3000`，数据持久化在 Docker volume `renarr-data` 中。

### GitHub Container Registry

向 `main` 分支推送或打 `v*` tag 时，GitHub Actions 会自动构建并推送镜像到 `ghcr.io`。Tag 策略：

| 事件      | Tags                  |
| --------- | --------------------- |
| push main | `main`, `sha-<short>` |
| tag v*    | `<version>`, `latest` |
