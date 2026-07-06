## Why

当前 rename plan 编辑依赖用户手动输入 TV 季和集信息，容易出现与 TMDB 剧集结构不一致的值；source path 也主要依赖手输，配置时缺少可发现性和校验前置提示。为这些输入提供来自 TMDB 和 WebDAV 的可选项，可以降低整理错误并提升路径配置效率。

## What Changes

- 在编辑 TV rename plan row 时，系统从当前 row/item 的 TMDB identity 获取季和集候选项，并在 season、episode 输入处提供下拉选项。
- 季/集下拉仍允许保留或输入当前解析出的值；当 TMDB 数据缺失、请求失败或用户需要特殊编号时，不阻塞手动编辑。
- 在 source path 或 library path 配置输入中，系统基于当前 WebDAV source 浏览目录，提供下拉选项和 autocomplete。
- source path/path 候选必须使用用户配置的 WebDAV URL 和凭据进行目录浏览，不改写 source URL，也不创建远端目录。
- 选项加载、空结果和错误状态必须在 UI 中可见，并且保存仍以用户最终提交的 path 字符串为准。

## Capabilities

### New Capabilities

### Modified Capabilities

- `manual-review-plans`: rename plan draft 编辑时增加 TMDB season/episode 候选项行为。
- `connectivity-testing`: WebDAV path 输入增加目录候选、autocomplete 和浏览失败语义。

## Impact

- 影响 rename plan draft API、TMDB service、planner/item detail 相关服务，以及 `RenamePlanPanel.svelte` 的 TV row 编辑控件。
- 影响 source/library path 设置 UI、WebDAV directory browse API 和 WebDAV client list directory 调用边界。
- 不引入数据库 schema 变更；候选项为按需获取的临时 UI 数据。
- 需要补充服务层/API 测试和 Svelte 组件交互测试或现有 V1 flow 覆盖。
