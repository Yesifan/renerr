## Context

Renarr 目前把媒体库一级目录/文件记录为 `library_items`，扫描时按远端 root-level entries 同步存在性，并在 `refreshItemStats()` 中统计内部视频和命名符合度。rename plan draft 会实时读取 WebDAV 文件，executor 执行后直接用本次成功移动的 target 列表回填 item 统计。

这导致几个耦合问题：

- 空目录仍会成为一个可见 item，并可能保留旧统计或进入待处理流程。
- source 与 target 完全相同的文件会被视为冲突或可执行行。
- 取消勾选的文件、原本已合规的文件不会参与执行摘要，执行后统计可能被写错。
- rename task 与 item detail 的 active task 关联不足，整理进度不明显。
- AList/夸克 WebDAV 在刚创建目录或连续跨目录移动后可能短暂返回 500，当前执行器没有重试。

项目仍处于 beta 阶段，可以调整本地 SQLite 数据形态和 API DTO，不需要为旧开发库提供无损迁移。

## Goals / Non-Goals

**Goals:**

- 让媒体库默认只展示包含视频的有效 item，空目录默认隐藏。
- 允许用户在 item detail 通过显式开关查看空目录/空内容状态，避免误以为数据丢失。
- 让 no-op plan row 不进入默认可执行集合，并在用户修改 row 后自然恢复可执行。
- 执行 rename plan 后以远端真实文件状态刷新 item 统计。
- 增强 WebDAV move 对目录可见性延迟和临时 500 的容错。
- 提升扫描、整理、TMDB 搜索、最终确认和长日志的 UI 可理解性。

**Non-Goals:**

- 不引入新的后台任务系统或队列依赖。
- 不长期保存 item 内部文件表；仍以扫描和 draft 生成时的实时 WebDAV 状态为准。
- 不在 item detail 默认展示完整实时文件列表。
- 不把执行失败重新引入为 item status。
- 不解决所有 WebDAV 服务端语义差异，只处理当前 AList/夸克路径下已暴露的 move 一致性问题。

## Decisions

### 1. 空目录默认隐藏，但保留 detail 显式查看入口

Library path 扫描仍以 root-level entries 为事实来源，但统计为 0 视频的目录不作为常规海报墙 item 展示。实现上优先通过 API 查询参数或 DTO 标记过滤，避免在扫描时直接删除仍存在的空目录记录造成用户无法解释“目录去哪了”。

item detail 增加“显示空目录/空内容”开关。默认关闭时隐藏空内容提示或空目录入口；打开后显示空目录状态、完整路径、最近扫描时间和可执行的重新扫描入口。

替代方案：扫描时硬删除空目录记录。这个方案能快速隐藏，但会丢失最近扫描、identity 继承和诊断上下文，不利于用户主动排查远端目录状态。

### 2. no-op row 是计划预览状态，不是执行动作

当 `sourceFilePath === targetFilePath` 时，draft row 应标记为 no-op，默认 `selected=false`，并在 UI 上显示“无需整理”。该 row 不应阻止进入最终确认，也不应进入 confirmed rename plan。

当用户修改影视 identity、season 或 episode 导致重新计算后的 target path 不同，row 重新按普通 row 处理：可选、可冲突检测、可提交。

替代方案：在 executor 中跳过同路径。这个方案太晚，用户仍会在计划编辑阶段看到不可理解的冲突或勾选失败。

### 3. 执行后统计以重扫为准

executor 完成一个 plan 后，对涉及的 library item 调用共享统计刷新逻辑，按远端实际状态更新 `videoFileCount`、`compliantFileCount`、`nonCompliantFileCount`。执行摘要仍记录 moved/failed/warnings，但不再作为 item 文件统计的唯一来源。

全部 selected rows 成功时，item 可标记为 `organized`；存在失败时，不设置 `failed` 状态，只更新 `lastExecutionSummaryJson` 并尽量刷新统计。若 item 原目录已被整理到新 top-level 目录，扫描/身份继承逻辑继续负责把新目录关联为 organized item。

替代方案：把未勾选 rows 合并进执行摘要。这个方案仍会漏掉远端侧变化和已存在合规文件，不如重扫稳妥。

### 4. WebDAV move 使用阶段化执行和远端事实对账

真实 AList/夸克探测显示，WebDAV `MOVE` 返回值不能作为最终事实：

- 成功基线：`MOVE` 返回成功后，立即检查可能出现 `source=false,target=false`，约 5 秒后才变为 `source=false,target=true`。
- 不稳定情况：跨目录同名移动有时返回 500，约 5 秒后 source 回滚出现。
- 不稳定情况：跨目录同名移动有时返回成功，但 source 和 target 在 30 秒甚至 120 秒内都不可见。
- 不稳定情况：跨目录且改名的单步 MOVE 会返回 500，不适合作为默认策略。

因此执行器不能把 `MOVE` 返回成功等同于整理成功，也不能把目标路径短时间不可见等同于失败。`MOVE` 只能表示提交了一次远端操作；后续必须通过 original source、renamed source、final target 的实际可见性对账来决定下一步。

跨目录且改名的业务移动仍拆为两段，但默认顺序改为先执行可靠的同目录 rename，再执行不稳定的跨目录 move：

1. `originalSource -> renamedSource`，其中 renamedSource 是原目录下的最终文件名。
2. `renamedSource -> finalTarget`，这是跨目录移动已经改好名字的最终文件。

这个顺序减少了目标目录下“原文件名 intermediate”的无语义状态，并降低多个来源同 basename 移入同一个 target dir 时的 intermediate 冲突概率。如果跨目录移动失败或回滚，文件大概率仍在原目录但已经是最终命名，比停留在目标目录的旧文件名更容易理解和恢复。

默认执行器应按阶段批量处理：

1. Phase 0 preflight：确认目标目录可见，检查 target 冲突和 renamed source 冲突。
2. Phase 1：批量提交 `originalSource -> renamedSource` 的同目录 rename。
3. Phase 1 reconcile：按检查点观察 originalSource/renamedSource 状态。renamedSource 可见才进入 Phase 2；originalSource 回滚可见才重试 Phase 1；两者都不可见则进入 remote settling，继续等待，不重复提交 MOVE。
4. Phase 2：批量提交 `renamedSource -> finalTarget` 的跨目录 move。
5. Phase 2 reconcile：finalTarget 可见才记为成功；renamedSource 回滚可见才重试 Phase 2；两者都不可见则继续等待。

恢复顺序应按语义从“最接近完成”到“最原始”检查：

1. finalTarget 存在：row 成功。
2. renamedSource 存在：已完成原地改名，继续 Phase 2。
3. originalSource 存在：尚未开始或已回滚，继续 Phase 1。
4. 以上都不存在：remote settling，等待对账检查点。
5. 多个路径同时存在：duplicate state，停止并要求人工检查。

对账状态机：

```text
source exists | destination exists | decision
------------- | ------------------ | -------------------------------
true          | false              | rollback/not moved; retry allowed
false         | true               | success
false         | false              | remote settling; wait, do not retry
true          | true               | duplicate state; stop for manual check
```

重试策略以“远端状态”驱动，而不是以错误码驱动。默认建议使用 5s、15s、30s、60s、120s、300s 检查点，最多观察 5-10 分钟。只有在 `source=true,destination=false` 时允许重新提交 MOVE；`source=false,destination=false` 时不重试，避免在远端仍处理或文件不可见时制造更多不可判定状态。

如果长期保持 `source=false,destination=false`，row 应进入 `indeterminate` 或等价的不可判定失败状态，任务记录需要提示用户等待远端同步、在 AList 检查实际文件位置，或重新扫描。该状态不是普通命名失败，不能把 item status 改为 `failed`。

execution records 必须保存每个阶段的 attempt、MOVE 返回结果、对账快照和最终 decision，便于解释“500 后 source 回滚”“MOVE accepted 但远端长期 limbo”等情况。

替代方案：直接单步 `source -> finalTarget`。真实探测显示跨目录且改名会返回 500，不能作为默认策略。

替代方案：先跨目录移动原文件名，再在目标目录改名。这个方案已经可工作，但会制造目标目录原文件名 intermediate；当跨目录移动出现 limbo 或多个来源同 basename 时，恢复和冲突处理都比“先原地 rename”更复杂。项目仍处于 beta 阶段，不保留旧 intermediate 兼容逻辑。

替代方案：单文件两段立即执行。这个方案会在 `source=false,destination=false` 的正常延迟窗口误判失败，正是当前 `Intermediate file was not visible after move` 的原因。

替代方案：每个文件固定 sleep。固定等待只能覆盖成功基线，无法处理 500 后回滚、长期 limbo 和重复状态；必须用对账状态机驱动重试。

### 5. active task 需要能从 item detail 看到整理进度

rename task 当前 targetKey 是 `renamePlan:<planId>`，而 item detail 只查询 `libraryItem:<id>`。实现时可以扩展 active task API 支持按 library item 反查相关 rename plan，或在提交 draft 后由页面继续跟踪返回的 task id 并轮询任务详情。

优先选择后端反查能力，让刷新页面后仍能看到整理中状态。前端提交后本地 task id 可作为即时补充。

### 6. UI 状态用现有组件和页面职责承载

媒体库详情和 item detail 使用明显但克制的状态条显示扫描/整理进度，不把操作表单放进海报 card。未识别占位海报在 card 内展示文件/文件夹名、图标和状态色。TMDB 搜索使用局部 loading，不把整页 busy 当作搜索状态。

任务详情和日志页对长路径/summary/context 提供展开或详情查看，默认表格仍保持可扫读。

## Risks / Trade-offs

- [Risk] 空目录隐藏可能让用户误以为远端目录被删除 → 通过 item detail 显式开关和扫描摘要说明空内容状态。
- [Risk] 执行后重扫增加 WebDAV 请求量 → 只对受影响 item 重扫，不在每个文件移动后重扫。
- [Risk] WebDAV 返回成功但远端长期不可见 → 引入 remote settling 和 indeterminate 状态，限制最长观察时间并保留对账快照。
- [Risk] WebDAV 500 后 source 可能短暂消失再回滚 → 只在确认 `source=true,destination=false` 后重试，避免 source 不可见时重复提交 MOVE。
- [Risk] 阶段化批量执行会让任务耗时更长 → 进度展示 phase、current/total、attempt 和等待原因，任务详情保留完整 execution records。
- [Risk] no-op row 从 confirmed plan 排除后，用户可能不知道为什么文件没执行 → 在 draft 和最终确认摘要中显示跳过/no-op 数量。
- [Risk] active rename task 反查需要 join plan/items/tasks → 保持查询只针对 queued/running 任务，并通过现有索引或小范围查询控制成本。

## Migration Plan

1. 扩展后端 DTO/API 和服务逻辑，保持 beta 本地库可直接通过 `db:push` 同步。
2. 更新 UI 组件和页面状态。
3. 增加单元/回归测试覆盖空目录、no-op、统计重扫、WebDAV 重试和任务详情。
4. 运行 `pnpm run check`、`pnpm test`、`pnpm build`、`pnpm run build:worker`。

Rollback 时可以恢复旧过滤和执行逻辑；新生成的任务/日志数据仍可作为普通历史记录展示。

## Open Questions

- “空目录主动显示”是否只需要 item detail 的开关，还是 library detail 也需要一个调试用 query 参数或二级入口？当前设计按用户要求只放在 item detail。
- WebDAV 500 重试的默认次数和退避间隔需要通过测试和实际夸克行为校准，建议先使用小次数、短退避。
