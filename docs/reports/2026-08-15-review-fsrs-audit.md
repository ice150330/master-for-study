# 阶段 10：主动检索与正式 FSRS 复习验收

## 设计依据

- 调度采用官方 `ts-fsrs` 5.4.1（FSRS 6），通过 adapter 使用 `repeat` 预览、`next` 排期和 `rollback` 撤销，业务层不直接依赖第三方枚举与字段名。
- Anki 官方复习流程验证了“先只显示问题、再显示答案、四档按钮展示下次间隔、Space 与 1–4 快捷键、困难卡标记”这一成熟交互模型。
- 参考资料：[ts-fsrs 官方仓库](https://github.com/open-spaced-repetition/ts-fsrs)、[ts-fsrs API](https://open-spaced-repetition.github.io/ts-fsrs/)、[Anki Studying](https://docs.ankiweb.net/studying.html)。

## 功能结果

- `ReviewCard` 保存 due、stability、difficulty、scheduled days、learning steps、reps、lapses 和 last review；原 `term_masteries` 保留为兼容投影。
- `ReviewLog` 完整保存 FSRS 评级前后状态、主动回忆文本/口头模式、耗时、算法版本和幂等键，原日志永不更新。
- 撤销写入独立 `review_undos`，仅允许撤销最近一次有效评级，并用官方 rollback 恢复卡片。
- `Again` 使用 1 分钟短期重学步骤，客户端评级后直接推进当前队列，不会立即无限回到队首。
- 问题面要求先输入回忆或确认完成口头回答；答案面并排显示自己的回忆、概念定义和四档预计间隔。
- Space 可揭示答案，数字 1–4 可评级；右轨提供来源跳转、记忆状态和困难卡标记。
- 队列顶部显示完成进度、到期、逾期和预计分钟数，评级与撤销会同步更新。

## 数据迁移

- `0008` 新建 review cards/logs/undos，并把旧 `term_masteries` 回填成完整卡片。
- `0009` 为到期查询与按卡片/术语回放日志增加索引。
- 真实库迁移前备份：`data/backups/mentor-before-phase10-20260815-0154.db`。
- 真实库迁移后：10 条迁移、26 个术语、26 条掌握投影、26 张 ReviewCard、0 条新日志、0 条撤销；`quick_check=ok`，外键检查为空。

## 截图审查

截图位于 `data/ui-captures/10-review-fsrs/`，不进入 Git。

- `question`：主动回忆输入区为视觉主任务，答案按钮在输入前明确禁用。
- `answer`：自己的回忆与标准定义层级清楚，四档按钮的含义和间隔可直接比较。
- `graded`：进度、剩余工作量和可撤销结果同步变化，下一卡不位移。
- `undo`：恢复原卡片与队列统计，不丢失操作反馈。
- `complete`：完成态保留最后一次撤销入口和一个继续学习动作。

五个 `1440x900` 状态经人工复核，无重叠、裁切、无效颜色令牌或页面横向滚动。

## 自动验证

- Vitest 覆盖正式调度预览/提交一致、Again 非零间隔、rollback、日志不可变、幂等、困难卡和旧数据回填。
- Playwright 覆盖问题面、答案面、评级推进、撤销、困难标记、口头模式、键盘评级、完成态和失败重试。
- TypeScript、ESLint、SQLite 完整性与 Next.js production build 作为提交前质量门执行。
