## ADDED Requirements

### Requirement: Library Path 可使用独立整理目标目录

系统 SHALL 允许 Library Path 配置同一 WebDAV source 下的可选整理目标目录。未配置整理目标目录时，rename plan MUST 继续使用 Library Path path 作为目标根目录；配置整理目标目录时，rename plan MUST 使用该目标目录作为 target path 根目录。Planner MUST 通过比较每个视频文件的当前完整 path 和按当前规则生成的 target 完整 path 决定是否生成可执行 rename plan row，而不是按是否配置整理目标目录或按文件名合规统计分支判断。

#### Scenario: 未配置整理目标目录

- **WHEN** 系统为 Library Path 下的 item 创建 rename plan
- **AND** 该 Library Path 没有配置整理目标目录
- **THEN** plan item 的 target file path MUST 继续以该 Library Path path 为根目录生成

#### Scenario: 配置整理目标目录

- **WHEN** 系统为 Library Path `/library` 下的 TV item `a` 创建 rename plan
- **AND** 该 Library Path 配置整理目标目录 `/target_path`
- **AND** 解析出的剧集信息为 season 1 episode 1
- **THEN** plan item 的 source file path MUST 指向 `/library/a/01.mp4`
- **AND** plan item 的 target file path MUST 以 `/target_path` 为根目录生成，例如 `/target_path/<show>/Season 01/<episode-name>.mp4`
- **AND** plan item 的 target file path MUST NOT 以 `/library` 为根目录生成

#### Scenario: 整理到目标目录后原 item 消失

- **WHEN** rename plan 将 Library Path `/library` 下的 item 文件移动到整理目标目录 `/target_path`
- **AND** 后续扫描 `/library`
- **THEN** 系统 MUST 按现有远端 item 消失规则硬删除原 `library_item`
- **AND** 系统 MUST NOT 自动把原 `library_item` 转换为 `/target_path` 下的 item

#### Scenario: 已整理 item 添加目标目录后再次生成 plan

- **WHEN** Library Path `/library` 下已存在 `organized` item
- **AND** 该 item 的当前视频文件 path 已符合命名模板
- **AND** 用户将该 Library Path 的整理目标目录更新为 `/target_path`
- **THEN** 下一次 plan 创建 MUST 按 `/target_path` 作为有效目标根目录生成 target file path
- **AND** 如果任一视频文件的当前完整 path 不等于生成后的 target 完整 path，系统 MUST 创建可执行 rename plan row

#### Scenario: 完整 path 相同时不生成可执行行

- **WHEN** 系统为 `identified` 或 `organized` item 创建 rename plan
- **AND** 该 item 的每个视频文件当前完整 path 都等于按当前 Library Path、整理目标目录、媒体身份和命名模板生成的 target 完整 path
- **THEN** 系统 MUST 将这些行视为 no-op
- **AND** `create_rename_plan_for_item` MUST 成功结束且不创建 confirmed rename plan

#### Scenario: 完整 path 不同时生成可执行行

- **WHEN** 系统为 `identified` 或 `organized` item 创建 rename plan
- **AND** 任一视频文件当前完整 path 不等于按当前 Library Path、整理目标目录、媒体身份和命名模板生成的 target 完整 path
- **THEN** 系统 MUST 为该视频文件创建可执行 rename plan row
- **AND** 目录不同、文件名不同或二者都不同 MUST 都被视为需要整理

#### Scenario: 沿用 overwrite 策略

- **WHEN** rename plan 使用整理目标目录生成 target file path
- **AND** target file 已存在
- **THEN** 自动 plan MUST 继续拒绝覆盖
- **AND** 手动 plan MUST 仅在用户批准 overwrite 后覆盖
- **AND** executor MUST 继续使用现有 row-by-row move 规则处理该 plan

### Requirement: Library Path 整理目标目录配置受路径关系约束

系统 SHALL 在创建或更新 Library Path 时规范化整理目标目录，并防止整理目标目录成为当前 Library Path path 的子目录。整理目标目录 MUST 隶属于同一个 WebDAV source，因为它作为该 Library Path 的字段保存，不能指定另一个 source。

#### Scenario: Target path 是 library path 子目录

- **WHEN** 用户为 Library Path `/library` 配置整理目标目录 `/library/organized`
- **THEN** 系统 MUST 拒绝保存
- **AND** 响应 MUST 使用稳定 validation error

#### Scenario: Target path 等于 library path

- **WHEN** 用户为 Library Path `/library` 配置整理目标目录 `/library`
- **THEN** 系统 MUST 将该配置视为未使用独立整理目标目录
- **AND** 后续 rename plan MUST 以 `/library` 作为目标根目录

#### Scenario: Target path 是 sibling 目录

- **WHEN** 用户为 Library Path `/library` 配置整理目标目录 `/target_path`
- **THEN** 系统 MUST 允许保存该配置
- **AND** 后续 rename plan MUST 以 `/target_path` 作为目标根目录

#### Scenario: Target path 是 parent 目录

- **WHEN** 用户为 Library Path `/library/inbox` 配置整理目标目录 `/library`
- **THEN** 系统 MUST 允许保存该配置
- **AND** 后续 rename plan MUST 以 `/library` 作为目标根目录

## MODIFIED Requirements

### Requirement: Library path 扫描遵循 item 状态规则

系统 SHALL 让 `scan_library_path` 同步当前 root-level `library_items`，并按每个 item 的状态处理。扫描得到的空目录或无视频目录 MUST 更新为空内容状态，并且 MUST NOT 作为默认媒体库列表中的可整理 item 展示。扫描 SHALL 只负责远端同步、统计刷新和影视识别；扫描 MUST NOT 直接创建 confirmed rename plan，也 MUST NOT 直接 enqueue `execute_rename_plan`。当 item 处于 `identified` 或 `organized` 且仍存在视频文件时，扫描 MAY enqueue `create_rename_plan_for_item`，由 planner 使用完整 `sourceFilePath !== targetFilePath` 判断是否存在可执行 rename rows。

#### Scenario: 远端 item 消失

- **WHEN** 已存储的 `library_item` 在 library root 不再存在
- **THEN** 系统 MUST 硬删除该当前 `library_item` 记录

#### Scenario: 远端 item 是空目录或无视频目录

- **WHEN** library path 扫描发现 root-level directory 存在但内部没有可统计的视频文件
- **THEN** 系统 MUST 将该 item 的视频数量、符合数量和待整理数量刷新为 0
- **AND** 系统 MUST 让该 item 从默认媒体库列表中隐藏
- **AND** 系统 MUST NOT 为该 item 创建整理计划创建任务

#### Scenario: 未识别 item

- **WHEN** 扫描 `unidentified` item 且该 item 包含视频文件
- **THEN** 系统 MUST 尝试识别，并在 high-confidence 时转为 `identified`，在 fuzzy、ambiguous、no-match 或 parse-failed 时转为 `pending_review`

#### Scenario: 新识别 item 进入计划创建任务

- **WHEN** 扫描将 `unidentified` item 成功转为 `identified`
- **THEN** 系统 MUST enqueue `create_rename_plan_for_item` for that item
- **AND** 系统 MUST NOT 在扫描任务内创建 confirmed rename plan

#### Scenario: 识别失败没有候选

- **WHEN** 扫描 item 时无法解析标题或 TMDB 没有候选
- **THEN** 系统 MUST 将 item 标记为 `pending_review`
- **AND** recognition candidates MUST 保存为空数组
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`

#### Scenario: 待确认 item

- **WHEN** 扫描 `pending_review` item
- **THEN** 系统 MUST 跳过该 item 的 TMDB 识别和整理计划创建
- **AND** 系统 MAY 刷新该 item 的空内容和文件统计以避免展示过期数量

#### Scenario: 发现历史整理目标目录

- **WHEN** library path 扫描发现一个一级目录等于历史 rename plan item 的 `target_top_level_path`
- **AND** 该 plan item 对应的旧 `library_item` 已有 TMDB identity
- **THEN** 系统 MUST 将旧 identity 继承到新目录对应的 `library_item`
- **AND** 新目录对应的 `library_item` MUST 标记为 `organized`

#### Scenario: 已识别 item

- **WHEN** 扫描 `identified` item
- **THEN** 系统 MUST NOT 再查询 TMDB
- **AND** 系统 MUST 刷新该 item 的文件统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item` for that item

#### Scenario: 已整理 item 仍存在视频文件

- **WHEN** 扫描 `organized` folder item
- **AND** 刷新后的 `videoFileCount` 大于 0
- **THEN** 系统 MUST 跳过 TMDB 识别
- **AND** 系统 MUST enqueue `create_rename_plan_for_item` for that item
- **AND** planner MUST use full path comparison to decide whether a confirmed rename plan is actually created

#### Scenario: 已整理 item 无视频文件

- **WHEN** 扫描 `organized` folder item
- **AND** 刷新后的 `videoFileCount` 等于 0
- **THEN** 系统 MUST 跳过 TMDB 识别
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`

### Requirement: Item 扫描是显式且受状态限制的

系统 SHALL 提供 `scan_library_item`，用于手动扫描单个符合条件的 `library_item`。Item 扫描 SHALL 只负责刷新统计和必要的影视识别；当扫描后 item 符合整理条件时，系统 MUST enqueue `create_rename_plan_for_item`，而不是直接创建 confirmed plan 或直接执行整理。Planner MUST use full `sourceFilePath !== targetFilePath` comparison to decide whether the queued plan creation produces executable rows.

#### Scenario: 扫描已整理 item 仍存在视频文件

- **WHEN** 用户手动扫描 `organized` item
- **AND** 刷新后的 `videoFileCount` 大于 0
- **THEN** 系统 MUST 刷新其内部视频数量和模板符合度统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB
- **AND** planner MUST create executable rows only for files whose current full path differs from the generated target full path

#### Scenario: 扫描已整理 item 无视频文件

- **WHEN** 用户手动扫描 `organized` item
- **AND** 刷新后的 `videoFileCount` 等于 0
- **THEN** 系统 MUST 刷新其内部视频数量和模板符合度统计
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB

#### Scenario: 扫描未识别 item

- **WHEN** 用户手动扫描 `unidentified` item
- **THEN** 系统 MUST 使用与 library path 扫描相同的规则尝试识别
- **AND** 如果 item 成功转为 `identified`，系统 MUST enqueue `create_rename_plan_for_item`

#### Scenario: 扫描已识别 item

- **WHEN** 用户手动扫描 `identified` item
- **THEN** 系统 MUST 刷新该 item 的文件统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB

#### Scenario: 扫描不符合条件的 item

- **WHEN** 用户尝试扫描 `pending_review` item
- **THEN** 系统 MUST 使用稳定 error code 拒绝请求
