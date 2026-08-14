# 阶段 4：API 合同、事务与事件模型验收

## 交付结果

- 所有公开 Route Handler 请求体由 zod 运行时校验，非法 JSON、非法枚举、无效 UUID 和未知字段统一返回结构化错误。
- 标准错误格式为 `{ error: { code, message, details? } }`，客户端同时兼容阶段 4 前的字符串错误。
- `LearningEvent` 新增 workspace、session、action、objectType、objectId、result、context、schemaVersion 和 idempotencyKey；旧 `type/entityId/metadata` 暂时同步写入，保证现有分析页不失效。
- 公开事件接口只允许 `code_run`，内部事件由 TypeScript 白名单约束；旧事件迁移为 `action=legacy`、`objectType=unknown`、`schemaVersion=1`。
- 会话、消息、术语、笔记、面试、复习和资源写入均携带幂等键；相同动作重试返回既有对象或结果。
- 业务状态和对应学习事件由同一 SQLite transaction 提交。

## 数据库迁移

迁移文件：`drizzle/0003_clear_black_tom.sql`。

真实本地库验证结果：

- `PRAGMA quick_check`：`ok`
- `PRAGMA foreign_key_check`：无异常
- Drizzle 迁移数：4
- `learning_events.idempotency_key`：唯一索引有效
- `messages.idempotency_key`：唯一索引有效

## 自动验证

- Vitest：7 个文件、35 个用例通过。
- Route Handler 合约：8 类非法输入均返回 400 标准错误，无效 JSON 返回 `INVALID_JSON`。
- 幂等集成测试：会话、消息、资源和复习重复请求不重复落库。
- 事务回滚测试：使用临时 SQLite trigger 强制事件写入失败，确认同事务资源记录没有残留。
- 阶段 3 Playwright 回归：5/5 通过，说明标准错误和幂等参数没有破坏失败恢复交互。
