# <img src="src/lib/assets/favicon.svg" alt="" width="28" style="vertical-align: -6px"> Renarr

Renarr 是深色管理台风格的 WebDAV 媒体库整理工具。

![Library detail](static/screenshots/library-detail.png)

## 功能

- 管理 WebDAV 影视目录（电影 / 电视剧）。
- 通过 TMDB 自动或手动识别媒体身份。
- 按命名模板自动整理视频文件和侧栏文件。
- 后台任务系统处理扫描、识别、计划创建和执行。
- Docker 部署，单容器运行 Web + Worker。

## 项目状态

Beta 阶段。正式发布前不要求数据库或 API 向后兼容；开发期间 schema/API 变化可能要求重建本地 SQLite 数据库。准备创建正式 release tag 前，需要先更新这段 beta 描述并重新确认兼容策略。

## Docker

### 构建

```sh
docker compose build
```

### 首次运行前生成 Secret Key

```sh
openssl rand -base64 32
```

### 启动

```sh
RENARR_SECRET_KEY=<your-key> docker compose up -d
```

或者将 key 写入 `.env` 文件：

```
RENARR_SECRET_KEY=<your-key>
```

然后直接 `docker compose up -d`。

默认监听 `localhost:3000`，数据持久化在 Docker volume `renarr-data` 中。

### 环境变量

| 变量                   | 说明                               | 必须 |
| ---------------------- | ---------------------------------- | ---- |
| `RENARR_SECRET_KEY`    | 凭据加密密钥（32 字节 base64）     | 是   |
| `RENARR_TMDB_BASE_URL` | TMDB API base URL 覆盖（用于代理） | 否   |

### GitHub Container Registry

向 `main` 分支推送或打 `v*` tag 时，GitHub Actions 自动构建并推送镜像到 `ghcr.io`。

| 事件      | Tags                  |
| --------- | --------------------- |
| push main | `main`, `sha-<short>` |
| tag v*    | `<version>`, `latest` |

---

开发者、AI agent 和贡献者请参考：

- **代码约定**：`docs/code-conventions.md`
- **后端/API 约定**：`docs/backend-conventions.md`
- **产品决策与核心文件**：`docs/product-decisions.md`
- **后台任务流程**：`docs/worker-task-flow.md`
- **已知未来事项**：`docs/future-work.md`
