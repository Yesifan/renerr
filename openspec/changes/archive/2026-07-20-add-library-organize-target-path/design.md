## Context

Renarr 当前的 Library Path 同时承担两个职责：扫描 WebDAV root-level item，以及作为 rename plan 的目标根目录。`planner.targetPathFor(...)` 使用 `library.path` 生成 `targetFilePath`，`executor` 只接收完整 source/target WebDAV path 并调用 FileClient move，因此跨目录整理能力主要受 planner 目标根选择和 Library Path 配置约束影响。

本变更采用方案 A：Library Path 可以是待整理入口。启用独立整理目标目录后，扫描仍只以 `library.path` 为事实来源；整理成功后原 item 从入口目录消失并在下一次扫描时硬删除。目标目录如果需要继续作为媒体库被管理，应由用户另行添加为 Library Path。

## Goals / Non-Goals

**Goals:**

- 让每个 Library Path 可选择整理到同一 WebDAV source 下的另一个根目录。
- 在添加和编辑 Library Path 时支持配置、测试和浏览整理目标目录。
- 在 create/update API、服务层 DTO、Drizzle schema 和前端类型中保持配置闭环。
- 让 rename plan 使用有效整理根目录生成 target path，并通过完整 path 比较决定是否需要整理，同时继续复用现有 executor overwrite 和 WebDAV/AList 跨目录 move 策略。
- 明确禁止整理目标目录成为当前 library path 的子目录，避免入口扫描包含归档结果。
- 新增和修改的前端用户可见文案全部通过 Paraglide messages 渲染。

**Non-Goals:**

- 不改变 `execute_rename_plan` 的 row-by-row move、conflict、overwrite 或 FileClient adapter 策略。
- 不让单个 Library Path 同时扫描入口目录和整理目标目录。
- 不在整理成功后把原 `library_item` 转换成目标目录中的 item。
- 不提供 beta 旧库无损迁移；继续按当前 beta 策略使用 Drizzle schema 和 `db:push`。

## Decisions

### Store an optional target root on `library_paths`

Add nullable `organizeTargetPath` to `library_paths`. A null value means “use `path` as the target root”. Avoid a separate boolean in the persisted model because the presence of a target path is the source of truth and reduces invalid states.

The UI can still expose a switch labeled “整理到其他目录”; turning it off submits `organizeTargetPath: null`. Turning it on requires a non-empty path.

Alternative considered: store both `organizeToDifferentPath` and `organizeTargetPath`. This is more explicit for UI state, but creates contradictory states such as enabled with null target, or disabled with stale target. The form can derive the switch state locally instead.

### Validate target path relation in service/schema layer

Normalize both `path` and `organizeTargetPath` with existing remote POSIX path normalization before persistence. Reject an organize target path that is a descendant of the library path. Exact equality should normalize to null/effective same-root behavior rather than a separate target, because it is not “other directory”.

Parent/sibling paths remain allowed. This matches the requested constraint narrowly: target path cannot be under the library path. The target root is always in the same source because it is stored on the same Library Path row and no second source id is accepted for target configuration.

### Keep path tests read-only

Extend or reuse the existing WebDAV path test endpoint so the settings UI can test the target path independently. The test validates that the target directory is listable and does not claim write permission. This matches the current connectivity-testing contract and avoids making test actions mutate remote storage.

### Planner chooses an effective organize root

Introduce a small helper in the source/planner boundary such as `effectiveOrganizeRoot(library)` returning `library.organizeTargetPath ?? library.path`. `buildRow(...)` passes this root to `targetPathFor(...)`.

Planner remains the single authority for deciding whether a row is executable. For every candidate video file it computes the target full path from the current effective root, media identity, naming templates, and source extension, then marks the row as no-op only when `sourceFilePath === targetFilePath`. This unified rule handles all cases:

- same directory and same filename: no-op
- same directory and different filename: rename
- different directory and same filename: move
- different directory and different filename: move and rename

`targetTopLevelPath` remains the top-level folder/file name relative to the target root. This is enough for UI preview and existing plan item storage, but historical identity inheritance during scans remains scoped to the scanning Library Path and therefore only applies when the target root is also scanned as a Library Path.

### Scanner does not pre-filter by filename compliance

Scanning should not decide whether an `identified` or `organized` item needs work by looking only at `nonCompliantFileCount`. A file can be filename-compliant but still live under the wrong root after `organizeTargetPath` changes. Instead, scan tasks enqueue `create_rename_plan_for_item` for `identified` items and for `organized` items that still contain videos. The plan creation task may then finish successfully with no confirmed plan if every generated row is no-op.

This preserves the existing separation: scanner synchronizes remote facts and schedules possible planning work; planner computes exact target paths and filters no-op rows.

### Editing target path is settings-level inline editing

Library Paths table should expose an edit action for the target directory configuration. The existing “添加” flow remains a modal. Editing should happen in-place or with a focused edit surface in the row, with an explicit save button, matching project UX guidance for modification actions.

All new labels, button text, empty/help text, validation messages shown in UI, and target path status copy should be added to `messages/zh-CN.json` and consumed through `$lib/i18n`. Backend task/log messages remain English and do not need UI localization.

## Risks / Trade-offs

- Target path is read-tested but not write-tested -> first actual write failure can still occur during execution. Mitigation: keep task detail lines clear and rely on executor partial failure handling; do not imply the test validates write permission.
- Scanning organized items with no pending path changes may enqueue extra plan creation tasks -> planner will cheaply finish with no executable rows; this trades a small background cost for correct relocation after target root or naming template changes.
- Users may expect organized items to remain visible under the original Library Path -> settings copy and table display must make the inbox/target distinction explicit.
- i18n keys can drift from component text during implementation -> include message file updates and generated Paraglide usage in the implementation tasks and verification.
- A target parent path can still overlap with the library path parent and be separately scanned by another Library Path -> validation only prevents the dangerous target-inside-source case requested here; duplicate management across separate Library Paths remains a user configuration concern.
- Existing history-based identity inheritance does not apply after moving outside the scanned root -> acceptable for方案 A; users add the target root as its own Library Path if they want organized target management.

## Migration Plan

- Update Drizzle schema with nullable `organize_target_path` on `library_paths`.
- Update library create/update schemas and service mapping. Beta databases can be synchronized with `pnpm run db:push`; no committed migration artifact is required before formal release.
- Existing Library Paths default to null target and therefore retain current behavior.
- Rollback is straightforward at beta stage: clear or remove the nullable target field and planner falls back to `library.path`.
