# 阶段 12：结构化自适应模拟面试验收

## 设计依据

- Exponent 的 AI mock interview 将成熟流程归纳为按角色选择练习、限时作答、基于真实 rubric 的多维评分、保留 transcript 并重复练习；本阶段采用其中适合本地学习工作台的部分，不引入音视频或社区匹配。
- 评分维度固定为正确性、结构、证据和表达，作答前不显示具体 rubric；反馈必须引用能在用户回答中逐字找到的片段，AI 引用不合法时由服务端归一化为真实原文。
- 参考资料：[Exponent AI Mock Interviews](https://www.tryexponent.com/practice/ai-mock-interviews)、[Exponent 10 分钟练习页](https://www.tryexponent.com/practice/ai/new)。

## 功能结果

- 面试开始前选择岗位、主题、基础/标准/进阶难度、3/5 轮和引导/严格/简洁风格，设置真实进入服务端出题上下文。
- 作答界面以题目和大输入区为主，计时采用稳定宽度数字；可基于当前草稿请求一次追问，追问提示明确禁止泄漏答案和评分线索。
- AI SDK 从已弃用的 `generateObject` 升级为 `generateText + Output.object`，题目同时生成 Skill 与内部 rubric，判分返回四维评分、原文证据、改进项、参考答案和策略。
- 数据分为 InterviewSession、Interview 题目投影和 InterviewAttempt 不可变版本；同题重答递增版本并展示总分和各维变化，不覆盖旧回答。
- 每次作答把策略、四维分数、耗时、题目难度和 Concept 写入 LearningEvent；advance/stay/downgrade 由服务端改变下一题难度。
- downgrade 会生成或复用前置 Concept，题目投影关联该 Concept，反馈与总结均提供直接学习入口。
- Toast 改为单通道，新反馈替换旧反馈，快速连续操作不会在右侧轨道堆叠遮挡。

## 数据迁移

- `0011` 新建 `interview_sessions` 和 `interview_attempts`，为场次状态、Attempt 幂等和题目版本增加索引；旧 `interviews` 仅增量增加场次、Concept、Skill、难度、rubric 和追问字段。
- 真实库迁移前备份：`data/backups/mentor-before-phase12-20260815-0232.db`。
- 真实库迁移后：12 条迁移，新表均为空，旧面试题数量保持 0；`quick_check=ok`，外键检查为空。

## 截图审查

截图位于 `data/ui-captures/12-interview-adaptive/`，不进入 Git。

- `settings`：五项设置按重要性分组，最近场次退居右侧，不与主操作竞争。
- `answering`：题目、计时、回答区和进度稳定，无任何 rubric 或参考答案线索。
- `followup`：追问以内联引用形态出现，不改变编辑区和底部动作位置。
- `feedback`：总分、策略、四维评分、原文证据、改进项和版本轨道可快速扫描。
- `retry-compare`：显示 60 到 85 的总分变化与各维增量，单通道 Toast 不遮挡内容。
- `summary`：三题轨迹明确呈现提升、回退、保持，并给出前置 Concept 入口。

六个 `1440x900` 状态经人工复核，无不合理重叠、横向滚动、动态跳位或无效颜色令牌。

## 自动验证

- Vitest 覆盖三档难度边界、评分归一、AI 伪造引用过滤和总分计算。
- SQLite 集成测试连续完成三题，证明难度按 `标准 → 进阶 → 标准` 变化，重答版本递增、失败题关联 Concept、场次完成和 Attempt 事件同事务写入。
- Playwright 覆盖设置、作答、追问、评分、重答对比、两次下一题、失败学习入口和最终总结。
- TypeScript、ESLint、Route Handler 合约、SQLite 完整性与 Next.js production build 作为提交前质量门执行。
