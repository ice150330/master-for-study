# 阶段 11：任务驱动 SQL 实践验收

## 设计依据

- SQLBolt 的成熟练习形态是短任务、可直接执行的编辑器和即时结果反馈，本阶段沿用其“说明、执行、验证、继续”的紧凑节奏，但将任务状态保存在本地学习轨道中。
- sql.js 官方提供 Web Worker 用法；本项目进一步在客户端封装 1.5 秒超时、Worker 重建和 100 行结果上限，避免长查询冻结主界面或大结果挤占页面。
- 参考资料：[SQLBolt Lessons](https://sqlbolt.com/lesson/1)、[sql.js 官方仓库](https://github.com/sql-js/sql.js/)。

## 功能结果

- Challenge 统一保存种子 SQL、任务说明、期望结果、分级提示、解法、技能和难度；首批覆盖筛选排序、分组聚合和 UPDATE 副作用。
- 桌面工作台以题目、Schema、SQL 编辑器和验证结果四个稳定区域组织，不把说明或结果塞进多层卡片。
- 查询任务比较列名、行数、值和顺序；副作用任务比较修改行数与验证查询的最终状态，从不比较用户 SQL 字符串。
- 每次执行都在新建 sql.js 数据库中重新播种，成功、语法错误、运行错误、超时和结果不符均生成结构化反馈。
- 分级提示逐条展开，查看解法需经过确认弹窗；重置只清空当前编辑状态，运行次数作为本次任务证据持续累计。
- PracticeAttempt 保存成功状态、错误类型、运行和提示次数、耗时、SQL、结果摘要与技能；状态写入和 `practice_attempted` LearningEvent 在同一事务完成。

## 数据迁移

- `0010` 新建 `practice_attempts`，增加幂等唯一索引和按挑战/时间查询索引。
- 真实库迁移前备份：`data/backups/mentor-before-phase11-20260815-0213.db`。
- 真实库迁移后：11 条迁移，`practice_attempts` 14 个字段；`quick_check=ok`，外键检查为空。

## 截图审查

截图位于 `data/ui-captures/11-practice-challenges/`，不进入 Git。

- `initial`：三栏任务工作台层级稳定，编辑器为主要操作面，Schema 可持续对照。
- `hint`：提示就地展开，不改变编辑器和结果区尺寸。
- `syntax-error`：错误类型、原始信息和再次运行路径清晰。
- `success`：SELECT 正确显示修改 0 行，结果表和完成反馈不重复表达。
- `side-effect`：UPDATE 正确显示修改 1 行和 Dave 的最终状态；同类 Toast 合并后不遮挡验证区。

五个 `1440x900` 状态经人工复核，无重叠、裁切、页面横向滚动或动态区域跳位。

## 自动验证

- Vitest 覆盖等价 SQL 的结果验证、列序和内容失败、无序结果以及副作用状态。
- 仓库集成测试覆盖 Attempt 幂等、技能证据与事件同事务写入；Route 合约覆盖 zod 边界。
- Playwright 使用真实 Web Worker 覆盖初始、提示、语法错误、查询成功、解法、分组和副作用，并验证第二次运行会恢复种子状态。
- TypeScript、ESLint、SQLite 完整性与 Next.js production build 作为提交前质量门执行。
