## 1. Data Model And API

- [x] 1.1 Add nullable `organizeTargetPath` / `organize_target_path` to `library_paths` in Drizzle schema and Library DTO types.
- [x] 1.2 Extend Library Path create/update Zod schemas to accept an optional organize target path.
- [x] 1.3 Normalize `path` and `organizeTargetPath` before persistence, treating equal paths as no independent target path.
- [x] 1.4 Reject create/update when the organize target path is a descendant of the Library Path path with a stable validation error code.
- [x] 1.5 Update `createLibrary`, `updateLibrary`, `listLibraries`, and `getLibrary` to persist and return organize target path.
- [x] 1.6 Update API routes and settings page actions to pass organize target path through create/update requests.

## 2. Rename Planning And Execution Semantics

- [x] 2.1 Add an effective organize root helper that returns `library.organizeTargetPath ?? library.path`.
- [x] 2.2 Update rename plan row building to pass the effective organize root to `targetPathFor(...)`.
- [x] 2.3 Make planner mark rows as executable solely by comparing full `sourceFilePath !== targetFilePath`.
- [x] 2.4 Update library and item scan scheduling so `identified` items and `organized` items with videos enqueue `create_rename_plan_for_item`; do not pre-filter organized items by `nonCompliantFileCount`.
- [x] 2.5 Preserve existing executor conflict, overwrite, sidecar, metadata, and WebDAV/AList cross-directory move behavior unchanged.
- [x] 2.6 Add regression coverage for `source/library/a/01.mp4` planning to `source/target_path/<show>/Season 01/<episode>.mp4`.
- [x] 2.7 Add regression coverage that a filename-compliant `organized` item creates executable rows after its effective target root changes.
- [x] 2.8 Add regression coverage that plan creation succeeds without a confirmed plan when all candidate files already have `sourceFilePath === targetFilePath`.
- [x] 2.9 Add regression coverage that scanning the source Library Path after successful target-root execution hard-deletes the original item instead of converting it.

## 3. Settings UI And i18n

- [x] 3.1 Add `messages/zh-CN.json` entries for all new and changed Library Path target directory labels, buttons, help text, status text, and validation errors.
- [x] 3.2 Update generated Paraglide usage as required so Svelte components import user-visible copy from `$lib/i18n`.
- [x] 3.3 Extend the add Library Path dialog with a switch for organizing to another directory and an organize target path input.
- [x] 3.4 Reuse the existing async WebDAV directory combobox behavior for organize target path suggestions.
- [x] 3.5 Add a read-only organize target path test action that uses the selected source and current target path input.
- [x] 3.6 Add inline edit UI for existing Library Path organize target configuration with explicit save and cancel controls.
- [x] 3.7 Ensure new and modified Svelte UI text for this feature contains no hard-coded Chinese strings outside Paraglide messages.

## 4. Validation And Connectivity Tests

- [x] 4.1 Add unit coverage for target path normalization, equal-path fallback, descendant rejection, sibling acceptance, and parent acceptance.
- [x] 4.2 Add API/service coverage for creating, editing, and clearing organize target path.
- [x] 4.3 Add WebDAV target path test coverage for readable paths, unreadable paths, and non-mutating behavior.
- [x] 4.4 Add tests confirming target path test responses and logs do not expose credentials.

## 5. Project Verification

- [x] 5.1 Run `pnpm run lint`.
- [x] 5.2 Run `pnpm run check`.
- [x] 5.3 Run `pnpm test`.
- [x] 5.4 Run `pnpm build`.
- [x] 5.5 Run `pnpm run build:worker`.
