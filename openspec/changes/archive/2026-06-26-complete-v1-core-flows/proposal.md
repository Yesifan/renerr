## Why

当前 V1 实现已经大致覆盖产品规格，但几个之前讨论确认的核心能力仍缺失或不可靠：未接入 Paraglide i18n，扫描和整理闭环不稳定，手动批准整理计划前无法预览和调整，手动 TMDB 搜索不可用，item 子文件的单独整理不完整，WebDAV/TMDB 连通性测试没有完整前端入口。

本变更用于补齐 V1 的核心使用闭环，让用户可以在 SvelteKit UI 中完成服务配置、连通性测试、媒体库扫描、待确认项处理、可编辑整理计划预览和可靠执行。

## What Changes

- 接入 Paraglide JS i18n，V1 内置 `zh-CN`，语言偏好保存为浏览器偏好。
- 增加 WebDAV 和 TMDB 前端连通性测试，并提供中文 UI 反馈和英文后端诊断日志。
- 按 V1 `library_items` 模型修复 library path 和 library item 扫描。
- 增加单个 library item 的扫描和整理支持。
- 修复并加固 rename plan 生成、校验、提交和 worker 执行。
- 增加手动整理计划的可编辑预览，允许用户勾选、调整映射和处理冲突后再执行。
- 为所有 `pending_review` item 提供手动 TMDB 搜索和 identity 指定能力。
- 统一 API 错误码、前端中文翻译和后端英文日志的边界。

## Capabilities

### New Capabilities

- `i18n-localization`: Paraglide JS 配置、locale messages、浏览器语言偏好、前端 UI 和错误提示本地化。
- `connectivity-testing`: WebDAV 来源/路径测试和 TMDB API 测试的 UI 与 API 行为。
- `scan-and-organize`: library path 扫描、library item 扫描、rename plan 执行、worker 行为和 item 状态流转。
- `manual-review-plans`: pending-review TMDB 搜索、identity 指定、可编辑 plan draft 预览、行调整、冲突处理和 plan 提交。

### Modified Capabilities

无。

## Impact

- 新增 `@inlang/paraglide-js` 及相关 i18n 生成和配置。
- 影响 SvelteKit layout、导航、设置页、媒体库详情页、item 详情页、任务页、日志页和共享 UI 文案。
- 影响 `/api/webdav/test`、`/api/webdav/browse`、`/api/settings`、`/api/library-items/*`、`/api/rename-plan-drafts`、`/api/rename-plans/*`、`/api/tasks`、`/api/logs`。
- 影响 scanner、planner、executor、TMDB、WebDAV/FileClient、settings、tasks、logs 和 error mapping 等 server services。
- 影响 worker task handlers 和 execution records。
- 需要补充 i18n、连通性 API、扫描状态流转、plan 生成/校验、手动复核流程和 worker 执行测试。
