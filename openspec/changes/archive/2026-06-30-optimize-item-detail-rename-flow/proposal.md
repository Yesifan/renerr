## Why

当前 item detail 页面把媒体摘要、手动指定和整理计划挤在多个 card 中，用户难以先理解媒体对象与远端文件，再安全地完成 TMDB 指定和重命名确认。现有 `failed` item 状态也混合了识别失败与重命名执行失败，导致扫描、整理和错误追踪语义不清。

## What Changes

- 重构 item detail 页面：移除摘要 card，将海报、影视信息、完整路径和统计整合为一个清晰的深色管理台详情视图；实时文件列表改为按需查看。
- 将手动指定和执行计划改为按钮触发的宽 dialog 多步流程。
- 手动指定流程支持先展示系统候选，也支持搜索 TMDB；选择 identity 后立即保存 item identity，并继续生成可编辑 rename plan。
- Rename plan draft row 支持行级 TMDB override：用户通过行内 TMDB 搜索为单行更换影视信息，不能自由输入自定义标题；该 override 只影响当前 row，不修改 item 主 identity。
- Rename plan 编辑步骤展示原始完整路径、影视标题、季/集、选择状态和冲突处理；最终确认步骤不用 table，以目标完整路径为主展示确认范围。
- `pending_review` 同时覆盖有候选和无候选的识别失败；扫描识别失败时也进入 `pending_review`，候选可为空。
- 停止使用 item status `failed` 表示重命名执行失败；执行失败仅保留在任务、日志和 execution records 中。
- 旧 `failed` item 按是否已有 identity 兼容迁移/兜底为 `identified` 或 `pending_review`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `manual-review-plans`: 手动指定、行级 TMDB override、可编辑计划和最终确认流程的需求变化。
- `scan-and-organize`: item 状态语义、扫描失败归入 `pending_review`、执行失败不回写 item status 的需求变化。
- `ui-shell-and-theme`: item detail 页面信息架构和深色媒体管理台布局的需求变化。

## Impact

- 影响 item detail 页面、手动指定组件、rename plan dialog/表格/确认 UI、状态 formatter 和中文文案。
- 影响 `/api/library-items/[id]/recognize`、`/api/library-items/[id]/plan`、`/api/rename-plan-drafts/[id]` 相关 DTO 与 update payload。
- 影响 planner、scanner、executor、items service、domain schema 和旧状态兼容逻辑。
- 需要更新 V1 核心流程测试、planner draft 更新测试、executor 状态回写测试，以及 Svelte check/build 验证。
