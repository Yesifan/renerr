## Purpose

定义后台任务状态、进度、事件日志、任务详情和日志存储控制规则，确保用户能从任务列表、任务详情和全局日志中理解任务运行结果。
## Requirements
### Requirement: 任务目标去重

系统 SHALL 对同一任务类型和同一业务目标的 queued/running 任务进行后端去重。For one-shot rename plan execution, the system SHALL also prevent executing a terminal rename plan again.

#### Scenario: 重复扫描同一 library path

- **WHEN** 用户请求扫描一个已有 queued 或 running `scan_library_path` 任务的 library path
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 重复扫描同一 library item

- **WHEN** 用户请求扫描一个已有 queued 或 running `scan_library_item` 任务的 library item
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 重复创建同一 item 的 rename plan

- **WHEN** 系统请求创建一个已有 queued 或 running `create_rename_plan_for_item` 任务的 library item
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 重复执行同一 rename plan

- **WHEN** 用户请求执行一个已有 queued 或 running `execute_rename_plan` 任务的 rename plan
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 执行已终止 rename plan

- **WHEN** 用户请求执行一个已经 succeeded、partially_failed 或 failed 的 rename plan
- **THEN** 系统 MUST reject the request with a stable error code
- **AND** 系统 MUST tell the UI to rescan and create a new plan instead

### Requirement: 任务进度模型

系统 SHALL 为 queued/running 任务提供可被 UI 消费的当前进度，而不是把进度 tick 写成历史运行记录或日志。

#### Scenario: 任务正在运行

- **WHEN** 任务处于 running 状态并完成一个可观测阶段
- **THEN** 系统 MUST 更新该任务的 progress
- **AND** progress MUST 包含当前 phase、简短 message 和可用的 current/total 计数

#### Scenario: 任务完成

- **WHEN** 任务结束为 succeeded、partially_failed 或 failed
- **THEN** 系统 MUST 写入任务完成摘要
- **AND** 摘要 MUST 保留足够信息展示成功、失败、跳过和 warning 的计数

#### Scenario: 计划创建任务完成

- **WHEN** `create_rename_plan_for_item` finishes
- **THEN** result summary MUST include item id, whether a plan was created, executable row count, skipped/no-op count, invalid count, auto execute status, and execution task id when present

#### Scenario: 整理任务完成后扫描排队

- **WHEN** an `execute_rename_plan` task finishes
- **THEN** result summary MUST include automatic scan enqueue results for affected source and target directories
- **AND** summary MUST distinguish MOVE row results from later scan synchronization state

#### Scenario: 整理任务被 worker 重启中断

- **WHEN** worker startup finds a running `execute_rename_plan` task
- **THEN** 系统 MUST finish that task as failed
- **AND** result summary MUST include counts for succeeded, failed, and pending plan items already stored in the database
- **AND** error or summary MUST explain that the user should scan affected directories before creating another plan

### Requirement: 任务详情

系统 SHALL 提供任务详情能力，用于查看单个任务的状态、进度、摘要和任务运行记录。任务详情 UI MUST 展示一个状态 card 和一个按时间排序的运行记录字符串列表。

#### Scenario: 查看扫描任务详情

- **WHEN** 用户打开扫描任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要和 task detail lines
- **AND** 系统 MUST NOT 在扫描任务详情中混入文件移动详情，除非这些详情来自同一个扫描任务直接创建的 task lines

#### Scenario: 查看计划创建任务详情

- **WHEN** 用户打开 `create_rename_plan_for_item` 任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要和 task detail lines
- **AND** summary MUST indicate whether execution was queued automatically

#### Scenario: 查看整理任务详情

- **WHEN** 用户打开整理任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要和 task detail lines
- **AND** 系统 MUST NOT require execution records to display file-level results

#### Scenario: 查看部分失败的整理任务详情

- **WHEN** 用户打开 partially_failed or failed rename task detail
- **THEN** UI MUST show row-level succeeded, failed, skipped, and warning counts from task summary when available
- **AND** UI MUST show failed row reasons from task detail lines
- **AND** UI MUST show FileClient failure stage and intermediate path when they are included in task detail lines

#### Scenario: 查看中断的整理任务详情

- **WHEN** 用户打开 failed rename task detail
- **AND** the task summary indicates worker interruption
- **THEN** UI MUST clearly indicate that remote files may have changed before the interruption
- **AND** UI MUST guide the user to scan affected directories instead of rerunning the same plan

#### Scenario: 查看长运行记录

- **WHEN** task detail line message exceeds the default container width
- **THEN** UI MUST wrap or otherwise expose the complete message
- **AND** UI MUST keep the complete message copyable

#### Scenario: 顶部不重复任务信息

- **WHEN** UI renders task detail page
- **THEN** page header MUST NOT duplicate task type, target, progress, or summary already shown in the status card

### Requirement: Item 相关 active task 可关联整理任务

系统 SHALL 允许 item detail 查询当前 item 相关的 queued/running 扫描任务、计划创建任务和整理任务。

#### Scenario: item 有 active scan task

- **WHEN** 当前 item 存在 queued 或 running `scan_library_item` 任务
- **THEN** active task 查询 MUST 返回该任务
- **AND** UI MUST 展示该任务状态和可用进度

#### Scenario: item 有 active plan creation task

- **WHEN** 当前 item 存在 queued 或 running `create_rename_plan_for_item` 任务
- **THEN** active task 查询 MUST 返回该任务
- **AND** UI MUST 展示该任务状态和可用进度

#### Scenario: item 有 active rename task

- **WHEN** 当前 item 关联的 rename plan 存在 queued 或 running `execute_rename_plan` 任务
- **THEN** active task 查询 MUST 能返回该整理任务或等价关联信息
- **AND** UI MUST 展示该整理任务状态和可用进度

#### Scenario: 刷新 item detail

- **WHEN** 用户刷新 item detail 页面且相关 plan creation or rename task 仍处于 queued 或 running
- **THEN** UI MUST 仍能发现并展示该任务
- **AND** UI MUST 提供进入任务详情的入口

### Requirement: 整理进度摘要面向用户可读

系统 SHALL 在 rename task progress 中提供适合 UI 展示的当前进度。

#### Scenario: 整理任务处理中

- **WHEN** `execute_rename_plan` task 正在处理 plan rows
- **THEN** progress MUST 包含 current、total、当前 phase 和简短 message
- **AND** progress counts MUST 包含 succeeded、failed 和 warnings

#### Scenario: 整理任务完成

- **WHEN** `execute_rename_plan` task 完成
- **THEN** result summary MUST 包含 total、moved、moveFailed 和 warnings
- **AND** UI MUST 能用该摘要展示完成结果

### Requirement: 任务运行记录是用户可读字符串列表

系统 SHALL persist user-visible task running records as ordered English string lines associated with a task id. These records SHALL be displayed by the client verbatim without i18n translation.

#### Scenario: 写入任务运行记录

- **WHEN** worker handles a business event that the user needs to understand
- **THEN** system MUST append a task detail line with task id, level, message, and created time
- **AND** message MUST be an English human-readable string
- **AND** message MUST be safe to display directly in the client

#### Scenario: 扫描识别成功

- **WHEN** a scan task identifies an item
- **THEN** system MUST append a task detail line such as `<item> was identified as <title>`

#### Scenario: 扫描设置候选

- **WHEN** a scan task cannot confidently identify an item but has TMDB candidates
- **THEN** system MUST append a task detail line such as `<item> candidates were set to <candidate list>`

#### Scenario: 扫描无法识别

- **WHEN** a scan task cannot identify an item
- **THEN** system MUST append a task detail line such as `<item> could not be identified: <reason>`

#### Scenario: 整理移动成功

- **WHEN** an execute rename task moves a file successfully
- **THEN** system MUST append a task detail line such as `<source> was moved to <target> successfully`

#### Scenario: 整理移动失败

- **WHEN** an execute rename task fails to move a file
- **THEN** system MUST append a task detail line such as `<source> failed to move to <target>: <reason>`
- **AND** the line MUST include failure stage and intermediate path when provided by the FileClient

### Requirement: pino 提供统一应用日志

系统 SHALL use pino for frontend, SvelteKit server, worker, and script logging through environment-specific logger modules. Logs SHALL be written in English and MAY include structured context for diagnostics. User-visible task detail lines SHALL also be emitted to pino through the task recorder.

#### Scenario: SvelteKit server 写入日志

- **WHEN** SvelteKit server code emits a diagnostic log
- **THEN** server pino MUST write an English JSON log entry to stdout in production
- **AND** the log MAY include structured context such as task id, plan id, item id, error, or counts
- **AND** server logger code MUST live in `$lib/server` or an equivalent server-only module

#### Scenario: Worker 写入日志

- **WHEN** worker code emits a diagnostic log
- **THEN** worker pino MUST write an English JSON log entry to stdout in production
- **AND** the log MUST include runtime `worker`

#### Scenario: Script 写入日志

- **WHEN** CLI or probe script code emits output
- **THEN** script logger MUST use pino instead of direct `console.*`
- **AND** human-readable development output MUST be produced through pino configuration rather than direct console calls

#### Scenario: 前端开发日志

- **WHEN** frontend code emits a diagnostic log in development
- **THEN** client pino MUST be used
- **AND** pino browser MAY output through browser console internally

#### Scenario: 前端生产日志

- **WHEN** frontend code emits a diagnostic log in production
- **THEN** client pino MUST be disabled
- **AND** frontend logs MUST NOT be transmitted to a server endpoint in this change

#### Scenario: 同步任务运行记录到 pino stdout

- **WHEN** system appends a user-visible task detail line
- **THEN** system MUST write the same message to pino
- **AND** pino context MUST include the task id

#### Scenario: 前端不读取 stdout 日志

- **WHEN** UI displays task detail
- **THEN** UI MUST read task detail lines from the application API
- **AND** UI MUST NOT parse pino stdout, container logs, or Docker logs as its data source

#### Scenario: 禁止直接 console 调用

- **WHEN** application, worker, or script code needs logging or command output
- **THEN** it MUST use the appropriate pino logger or task recorder
- **AND** it MUST NOT call `console.*` directly

#### Scenario: stdout 由运行环境轮转

- **WHEN** the application runs in production
- **THEN** pino MUST write Node-side logs to stdout
- **AND** application code MUST NOT implement pino file rotation
- **AND** Docker logging driver or the host process manager MUST be responsible for stdout retention and rotation

#### Scenario: 日志脱敏

- **WHEN** pino logger writes structured context
- **THEN** logger configuration MUST redact credentials, encrypted credentials, API keys, authorization headers, cookies, passwords, and tokens
- **AND** redaction paths MUST be statically configured by the application, not derived from user input

#### Scenario: 子 logger 绑定上下文

- **WHEN** code logs from a specific runtime, component, or task
- **THEN** it SHOULD use pino child logger bindings for runtime, component, task id, task type, target key, plan id, or item id as applicable
- **AND** bindings MUST NOT include secrets or large external API responses

### Requirement: task recorder 独占 DB 任务运行记录写入

系统 SHALL use a dedicated task recorder API for all DB-backed task detail lines. Generic pino logger usage SHALL NOT write task detail lines.

#### Scenario: 写入 DB 任务运行记录

- **WHEN** worker or server code needs to record a user-visible task event
- **THEN** it MUST call the task recorder
- **AND** the task recorder MUST insert one `task_detail_lines` row
- **AND** the task recorder MUST emit the same English message to pino with task context

#### Scenario: 普通诊断日志不写 DB

- **WHEN** code emits a diagnostic log that is not part of user-visible task history
- **THEN** it MUST use pino logger directly
- **AND** it MUST NOT create a `task_detail_lines` row

#### Scenario: 业务代码不直接插入 task_detail_lines

- **WHEN** code outside the task recorder needs task detail persistence
- **THEN** it MUST use the task recorder API
- **AND** it MUST NOT directly insert into `task_detail_lines`

