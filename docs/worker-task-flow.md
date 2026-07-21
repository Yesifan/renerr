# Worker Task Flow

## 概述

Worker 是一个独立进程，持续轮询数据库中的 `queued` 任务，CAS 更新为 `running` 后分发执行。入口文件 `src/worker/index.ts`。

Worker 支持 4 种任务类型，启动时自动标记中断任务。

## 生命周期

```
Worker 启动
  └─ failRunningTasksOnStartup()
       └─ 将所有 running 任务 → failed（含中断摘要）
       └─ 如有 running 的 rename plan → plan status 标记为 executed

while(true) 循环：
  claimNextTask()
    └─ CAS: 查找最旧 queued task，更新为 running
    └─ 无任务时 wait 1s 后重试

  dispatch 按 task.type：
    scan_library_path          → scanLibraryPath()
    scan_library_item          → scanLibraryItem()
    create_rename_plan_for_item → runCreateRenamePlanForItemTask()
    execute_rename_plan        → executeRenamePlan()

  finishTask(state, summary)
    └─ 写 state、resultSummaryJson、finishedAt
```

## 任务类型

### scan_library_path

**Payload**: `{ libraryPathId }`

1. 读取 Library Path 远端一级目录（文件夹 + 根目录视频文件）。
2. 对每个一级条目：

   ```
   远端存在且 DB 有记录 → 继承已有 identity，刷新视频统计
   远端存在且 DB 无记录 → 新建 library_item
       状态 = unidentified
       尝试解析文件名 → TMDB 搜索
           精确唯一匹配 → identified 并 enqueue create_rename_plan_for_item
           模糊/无结果/TMDB 错误 → pending_review
       刷新三个统计字段
   远端已消失 → 硬删除 library_item
   ```

3. `identified` item 不再查 TMDB，`organized` item 有视频时 enqueue 计划创建。
4. `pending_review` 只刷新统计，不执行自动识别。

**Result summary**: `{ added, removed, identified, enqueued }`

**Target key**: `libraryPath:<id>`

### scan_library_item

**Payload**: `{ libraryItemId }`

与 `scan_library_path` 相同，但只针对单个 item。

- `unidentified` → 刷新统计 + 识别
- `pending_review` → 仅刷新统计
- `identified` → 刷新统计
- `organized` → 刷新统计，有视频时 enqueue 计划创建

**Target key**: `libraryItem:<id>`

### create_rename_plan_for_item

**Payload**: `{ libraryItemId }`

1. 校验 item 状态：必须是 `identified` 或 `organized`。
2. 实时读取 item 所在远端目录的视频文件（递归，movie 深度 1 层、tv 深度 2 层）。
3. 计算每个视频的目标路径（基于 TMDB identity、命名模板、`organizeTargetPath`）。
4. 过滤：
   - source path === target path → no-op（排除）
   - 无法解析 season/episode（tv 缺少集数）→ invalid（排除）
5. 剩余 executable rows → 创建一次性的 confirmed rename plan。
6. 如果 Library 配置了 `autoOrganize` → enqueue `execute_rename_plan`。

**Result summary**: `{ itemId, planId?, executableRows, noopRows, invalidRows, autoExecute, executionTaskId? }`

**Target key**: `libraryItem:<id>`

### execute_rename_plan

**Payload**: `{ planId }`

1. Plan: `confirmed` → `executing`。
2. 逐 row 处理：
   ```
   source → 检查 target 冲突
          → 创建 target 目录
          → 移动视频
          → 移动 sidecar（字幕等）
          → 按设置写 NFO + poster
          → row status: succeeded / failed / conflict
   ```
3. Plan: `executing` → `executed`。
4. Enqueue 后置 `scan_library_path`（该 Library 的去重单次扫描）。
5. 不直接修改 `library_items` 状态；后置扫描根据远端事实更新。

**Result summary**: `{ planId, total, succeeded, failed, conflicts, warnings, state }`

**Possible states**: `succeeded` / `partially_failed` / `failed`

**Target key**: `renamePlan:<id>`

## 任务状态机

```
queued ──→ running ──→ succeeded
                  ├──→ partially_failed
                  └──→ failed
```

### Worker 重启中断

- Worker 启动时：所有 `running` task → `failed`。
- Rename plan 中断时：
  - Plan 标记为 `executed`（一次执行语义）。
  - 摘要包含已持久化的 succeeded / failed / pending count。
  - 已成功的移动不会回滚。
  - 用户应扫描受影响的 Library Path 后重新创建计划。

## 去重规则

同 `task type` + 同 `targetKey` + 状态为 `queued` 或 `running` → 复用已有任务，不重复创建。

| 类型                        | targetKey          | 重复范围                                   |
| --------------------------- | ------------------ | ------------------------------------------ |
| scan_library_path           | `libraryPath:<id>` | queued/running                             |
| scan_library_item           | `libraryItem:<id>` | queued/running                             |
| create_rename_plan_for_item | `libraryItem:<id>` | queued/running                             |
| execute_rename_plan         | `renamePlan:<id>`  | queued/running + 检查 plan 是否已 terminal |

`execute_rename_plan` 额外检查：该 plan 不能已有 terminal 执行任务（succeeded/partially_failed/failed）；整个 plan 只能执行一次。

## 任务持久化

### 状态与摘要

```
tasks 表：
  state          → queued → running → terminal
  progressJson   → running 阶段可写入阶段、current/total、message
  resultSummaryJson → 任务完成时写入总结
  error          → failed 时写入错误信息
  startedAt / finishedAt
```

### 运行记录

使用 `task_detail_lines` 持久化用户可读的英文字符串：

- 写入：`src/lib/server/services/task-detail-lines.ts` 的 `appendTaskDetailLine()`
- 读取：`src/lib/server/services/task-detail-lines.ts` 的 `listTaskDetailLines()`
- 展示：`/system/tasks/[id]` 页面显示所有运行记录
- 清理：`cleanupTaskDetailLines()` 按 `logRetentionDays` 清除旧数据（当前未在生产中调度）

## 相关文件

| 职责                          | 文件                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Worker 循环                   | `src/worker/index.ts`                                                                      |
| 任务 enqueue / claim / finish | `src/lib/server/services/tasks.ts`                                                         |
| Task detail lines 持久化      | `src/lib/server/services/task-detail-lines.ts`                                             |
| 扫描                          | `src/lib/server/services/scanner.ts`                                                       |
| 计划创建                      | `src/lib/server/services/planner.ts`                                                       |
| 计划执行                      | `src/lib/server/services/executor.ts`                                                      |
| WebDAV 文件操作               | `src/lib/server/integrations/webdav-client.ts`                                             |
| 命名模板                      | `src/lib/server/services/naming.ts`                                                        |
| 文件名解析                    | `src/lib/server/services/parser.ts`                                                        |
| 文件合规判断                  | `src/lib/server/services/compliance.ts`                                                    |
| 任务去重与状态                | `src/lib/server/services/tasks.ts`                                                         |
| Task schema                   | `src/lib/server/db/schema.ts`（tasks、task_detail_lines、rename_plans、rename_plan_items） |
