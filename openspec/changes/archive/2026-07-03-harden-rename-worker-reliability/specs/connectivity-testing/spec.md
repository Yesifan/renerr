## ADDED Requirements

### Requirement: WebDAV MOVE 可见性探针

系统 SHALL provide a developer-facing WebDAV visibility probe for diagnosing path-level and directory-level visibility after MOVE-related operations. The probe SHALL NOT be required by the business rename executor success path.

#### Scenario: 探针对比四种可见性信号

- **WHEN** developer runs the probe with source and target paths
- **THEN** the probe MUST report `exists(source)`, `exists(target)`, whether `listDirectory(sourceDir)` contains the source basename, and whether `listDirectory(targetDir)` contains the target basename
- **AND** the probe MUST print timestamped rows for each configured checkpoint

#### Scenario: 探针对比 no-cache headers

- **WHEN** developer runs the probe with no-cache comparison enabled
- **THEN** the probe MUST collect results for normal WebDAV requests and no-cache WebDAV requests
- **AND** the output MUST make differences between the two modes visible

#### Scenario: 探针不泄漏 secret

- **WHEN** probe prints output or errors
- **THEN** it MUST NOT print WebDAV passwords, encrypted credentials, TMDB keys, or private tokens

#### Scenario: 探针默认不修改远端

- **WHEN** developer runs the probe without an explicit MOVE action option
- **THEN** the probe MUST only perform read-only visibility checks
- **AND** it MUST NOT create, move, rename, overwrite, or delete remote files

#### Scenario: 探针执行真实 MOVE

- **WHEN** developer explicitly requests a MOVE probe with source and target paths
- **THEN** the probe MUST clearly print the planned source and target before executing
- **AND** the probe MUST record MOVE return result and subsequent visibility checkpoints
- **AND** the probe result MUST NOT change the business executor's rule that MOVE request success/failure is the row execution result
