## Context

Renarr 的整理执行运行在独立 worker 中，远端文件位于 WebDAV/AList/夸克。真实探针显示，WebDAV `MOVE` 返回值、单路径 `exists(PROPFIND Depth:0)`、目录 listing、AList 网页视图之间并不总能在固定时间内一致：

- 失败任务最终可通过扫描/目录 listing 看到 35/35 个 target 文件已经移动成功。
- 临时跨目录同名 MOVE 曾出现 `MOVE` 返回成功，但 0s、5s、15s、30s 后 source 和 target 在 `exists` 与 listing 中都不可见。

这说明 executor 无法通过短时间或长时间轮询可靠证明远端最终状态。继续把 worker 设计成“远端状态证明器”会让实现复杂、请求频繁，并且仍然无法保证正确。新的边界是：整理执行负责提交请求和记录请求结果，扫描负责读取远端事实并同步媒体库。

## Goals / Non-Goals

**Goals:**

- 简化 rename plan 执行策略，避免长时间 settling、复杂 reconciliation 和不可判定状态。
- 单个 plan item MOVE 失败后继续执行后续 items，最大化本批次可提交的整理操作。
- 让任务摘要诚实表达 MOVE 请求成功/失败和扫描排队情况。
- 整理完成后自动扫描所有受影响源目录和目标目录，依赖 scanner 同步真实媒体库状态。
- 保持 rename plan 一次性执行，terminal plan 不允许再次执行。

**Non-Goals:**

- 不把 rename plan 设计成分布式事务。
- 不尝试在 executor 中证明 AList/夸克最终一致性。
- 不在 MOVE 失败后回滚已经提交成功的其他 MOVE。
- 不由 executor 直接更新 `library_items` 的 organized 状态或文件统计。
- 不支持 worker 重启后继续执行同一个 plan。

## Decisions

### 1. Executor 按 row 顺序执行 FileClient move

每个选中的 plan item 独立执行，并且一行完整处理完再进入下一行。执行前仍保留必要的本地业务校验，例如 source/target path、overwrite 规则、目标文件冲突检查、WebDAV URL 不改写等。真正提交移动时，executor 只调用一次 FileClient 语义操作：

```text
for row in selectedRows:
  preflight(row)
  client.moveFile(row.source, row.target)
  postActions(row)
  persist row result
```

executor 不再把整批 rows 拆成 rename-in-place 批次和 final-move 批次。这样任何时刻最多只有当前 row 处于中间态，任务详情也能把失败归因到具体 row。

FileClient `moveFile` 返回成功时，executor 记录该 row succeeded/submitted；`moveFile` 抛出错误时，executor 记录该 row failed。executor 不再为了证明成功而等待 target 可见，也不再根据 `source=false,target=false` 进入长时间 settling。`exists` 和 `listDirectory` 可以用于执行前冲突校验和诊断，但不作为 MOVE 成功后的业务证明循环。

替代方案是保留目录 listing 对账和 indeterminate 状态。这个方案能解释一部分缓存问题，但探针已经证明 listing 也可能无法在固定时间内给出结论，复杂度超过收益。

### 2. FileClient adapter 封装跨目录改名策略

FileClient 的接口语义保持简单：`moveFile(from, to, options)` 表示“把 from 移到 to”。executor 不关心底层存储是否支持一步完成跨目录改名。

WebDAV/AList adapter 内部使用更稳的两步策略：

```text
from: /a/01.mp4
to:   /target/a.s01e01.mp4

step 1 rename_in_place:
  /a/01.mp4 -> /a/a.s01e01.mp4

step 2 move_to_target:
  /a/a.s01e01.mp4 -> /target/a.s01e01.mp4
```

同目录改名、跨目录同名移动或支持一步跨目录改名的未来存储 adapter 可以选择更直接的实现。关键是这个差异属于 storage adapter，不属于 rename executor。

FileClient move 结果和错误需要保留步骤信息：

```ts
type MoveStage = 'direct_move' | 'rename_in_place' | 'move_to_target';

type MoveResult = {
	ok: true;
	steps?: { stage: MoveStage; from: string; to: string; ok: true }[];
	warnings?: Record<string, unknown>[];
};

class FileMoveError extends Error {
	stage: MoveStage;
	from: string;
	to: string;
	intermediate?: string;
	cause?: unknown;
}
```

如果 `rename_in_place` 失败，executor 记录“原地 rename 失败”。如果 `move_to_target` 失败，executor 记录“最终移动失败”，并把 intermediate path 写入 execution record，方便用户理解后续扫描为什么可能看到中间文件。

### 3. Row 失败继续执行后续 rows

单个 plan item 失败不终止整个计划。worker 记录该 row 的失败原因，然后继续处理剩余 selected rows。

最终任务状态按计数决定：

```text
failed_count = 0 -> succeeded
failed_count > 0 and succeeded_count > 0 -> partially_failed
failed_count > 0 and succeeded_count = 0 -> failed
```

如果现有任务状态枚举暂时不支持 `partially_failed`，实现可以用 `failed` 表示任务非全成功，但 summary 必须包含 succeeded/failed/skipped/warning counts，避免用户误解为没有任何文件移动成功。

### 4. Rename plan 一次性执行

confirmed plan 被 enqueue 或开始执行后，只能对应一个 active/terminal `execute_rename_plan` task。task 结束为 succeeded、partially_failed 或 failed 后，plan 进入 terminal 状态，不允许再次提交。

原因是 plan 的 source/target 来自某次远端快照。执行后远端事实已经变化，重复执行旧 plan 容易产生重复 MOVE、冲突或误覆盖。用户需要重新扫描，再基于当前事实生成新 plan。

### 5. Scanner 是媒体库事实来源

executor 不直接把 `library_items` 标记为 organized，也不直接更新 video/compliant/non-compliant 统计。所有媒体库 item 状态、路径存在性和统计结果，都由 scanner 根据远端目录当前可见状态同步。

为了让 UI 尽快回到真实状态，rename task 完成后自动 enqueue 扫描任务。扫描范围来自本次 selected plan rows 的受影响目录：

```text
source directories: unique parent/top-level source dirs
target directories: unique parent/top-level target dirs
scan directories = dedupe(source directories + target directories)
```

具体扫描粒度应复用现有 scanner 能力：如果系统已有 scan library item/path 入口，则优先选择能覆盖该目录变化且不会重复扫描过多范围的最小任务目标。任务 summary 记录扫描 enqueue 成功、去重返回已有任务或失败的目录列表。

### 6. Worker 重启不恢复旧 plan

worker 启动时发现 running `execute_rename_plan` task，应把任务结束为 failed/interrupted 语义，并根据已写入的 plan item 状态和 execution records 生成摘要。不要继续执行同一个 plan。

重启后远端可能已经完成部分 MOVE，也可能处于 AList 延迟可见状态。正确恢复路径是扫描受影响目录，以远端事实刷新媒体库，然后生成新 plan。

### 7. 探针保留为诊断工具

WebDAV MOVE 可见性探针保留，用于开发者验证 `exists(source)`、`exists(target)`、source listing、target listing 和 no-cache header 的差异。探针默认只读，真实 MOVE 需要显式参数。

探针不驱动业务 executor 逻辑；它的价值是解释具体服务端边界和辅助排查，而不是成为整理成功判定机制。

## Risks / Trade-offs

- [Risk] MOVE 返回成功但远端最终没有出现目标文件 -> 扫描会暴露真实状态，任务摘要只表达请求结果，不承诺媒体库已经收敛。
- [Risk] MOVE 返回失败但远端后来完成移动 -> 本次任务仍记录 row 失败，后续自动扫描会把媒体库修正为真实状态。
- [Risk] 自动扫描可能增加 AList 压力 -> 仅扫描去重后的受影响源/目标目录，并复用任务去重。
- [Risk] executor 不直接更新 item 摘要会让整理结束到扫描完成之间短暂显示旧状态 -> UI/summary 应显示扫描已排队或正在运行。
- [Risk] terminal plan 不可重跑会让用户需要重新生成计划 -> 这是为了避免旧快照重复执行；扫描后再计划更符合远端事实模型。

## Migration Plan

1. 收敛 rename plan 和 plan item 状态枚举，移除或不再使用 settling/indeterminate 作为业务执行结果。
2. 调整 FileClient move result/error 类型，表达 move steps 和失败 stage。
3. 将 WebDAV/AList 跨目录改名实现封装进 WebDAV FileClient adapter。
4. 重构 executor，按 row 调用 `client.moveFile(source, target)`，立即记录成功/失败，失败继续后续 rows。
5. 移除 executor 中分批 rename phase/final move phase 和 MOVE 后长时间 visibility reconciliation 循环，保留执行前必要校验。
6. 调整任务完成摘要，记录 row counts、失败 stage、失败详情和自动扫描 enqueue 结果。
7. 在 rename task 完成后 enqueue 去重后的受影响源/目标目录扫描。
8. 确保 scanner 根据当前远端事实同步 item identity、存在性和统计，不依赖 executor 直接写 item 摘要。
9. 更新任务详情 UI/API，区分“MOVE 请求执行结果”和“扫描后的媒体库状态”。
10. 保留并验证 WebDAV 探针脚本的安全输出。
11. 运行 OpenSpec validate 和项目检查测试。

Rollback 时可以恢复旧 executor 逻辑；已经写入的任务摘要和 execution records 仍作为历史记录展示。

## Open Questions

- 自动扫描的最小粒度应使用 scan library item 还是 scan library path？倾向选择能覆盖受影响 top-level 目录且复用现有去重能力的最小粒度。
- 任务状态是否正式新增 `partially_failed`？如果当前系统已经使用该状态，应沿用；否则 beta 阶段可以新增，或先用 `failed` 加 summary counts 表达部分成功。
