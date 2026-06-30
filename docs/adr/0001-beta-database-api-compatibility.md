# Beta 阶段的数据库和 Drizzle 改造策略

Renarr 当前处于开发中的 beta 阶段，正式发布前数据库 schema 和 API 可以按当前产品模型直接调整，不要求对已有 SQLite 数据库或旧 API 做无损升级/向后兼容；旧开发库不兼容时直接重建，beta 期间废弃的 legacy 数据修正逻辑也不迁入新的 drizzle-kit 迁移历史。数据库结构以 `src/lib/server/db/schema.ts` 作为唯一真实来源，所有表、索引和约束都进入 Drizzle schema，并由 drizzle-kit 生成和维护迁移；`drizzle.config.ts` 和迁移输出目录 `drizzle/` 放在仓库根目录。生产服务层统一通过 Drizzle API 访问 SQLite，不再把 `getSqlite()` 或 raw `better-sqlite3` handle 作为业务代码可用的公共接口，底层 connection 只用于 Drizzle migrator 和少量测试辅助场景。

实施顺序分两层：先完成 schema 补全、`drizzle.config.ts`、初始 migration、启动 migrator 和 raw handle 边界，再逐个服务把 `prepare`/`exec` 查询替换为 Drizzle builder，期间不夹带业务规则变更。DB raw SQL 边界通过 agent 约定和 code review 维护，不新增自动化检查脚本；当前 beta 阶段不保留旧库构造/迁移边界测试，已有 legacy 迁移测试可删除，未来正式兼容阶段如果需要构造旧 schema 测试再允许测试辅助代码使用 raw SQL。这样可以把 Drizzle API 化和迁移系统改造做成干净的目标结构；代价是开发期数据需要按需重建，正式 release tag 前必须重新确认并更新兼容策略。
