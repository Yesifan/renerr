# Renarr

## SPEC

默认优先使用中文进行文档的编写。

## UI/Code 必须遵守的规则

- "添加"类操作使用模态框承载表单，不要常驻为内容 card。
- "修改"类操作保留在原位置内联编辑，并提供明确的保存按钮。
- 列表里的二值设置优先用 Switch，不用纯文本"开启/关闭"代替可操作控件。
- 不要把同一个管理对象放到多个同级页面重复维护；需要保留旧 URL 时使用重定向。
- 使用 Svelte 5 runes 风格：`$state`、`$derived`、`$props`，事件使用 `onclick`/`onchange`。
- 列表必须使用 keyed each blocks。
- 表单输入使用 `bind:value` / `bind:checked`；需要立即持久化的控件用事件调用 API。

## 文档索引

- 用户文档与 Docker 部署：`README.md`
- 代码约定（shadcn、i18n、验证、Svelte MCP 工具）：`docs/code-conventions.md`
- 后端/API 约定（DB、迁移、API 策略、执行规则）：`docs/backend-conventions.md`
- V1 产品决策与核心实现文件索引：`docs/product-decisions.md`
- 后台任务流程（worker 生命周期、4 种任务类型、状态机）：`docs/worker-task-flow.md`
- 已知无效边界和未完成能力：`docs/future-work.md`
- 扫描、识别、计划和执行规则：`openspec/specs/scan-and-organize/spec.md`
- 手动指定和 plan draft 规则：`openspec/specs/manual-review-plans/spec.md`
- 任务状态、进度和任务记录：`openspec/specs/task-observability/spec.md`
- 页面信息架构和操作规则：`openspec/specs/ui-shell-and-theme/spec.md`
- WebDAV/TMDB 测试和目录浏览规则：`openspec/specs/connectivity-testing/spec.md`
- SvelteKit load/action/API 边界：`openspec/specs/sveltekit-data-boundaries/spec.md`
- I18n 规则：`openspec/specs/i18n-localization/spec.md`
- 数据库和 beta 兼容策略：`openspec/specs/database-persistence/spec.md`、`docs/adr/0001-beta-database-api-compatibility.md`

> `openspec/changes/archive/` 只保存历史变更，不作为当前实现规范；当前行为以代码和上述现行文档为准。
