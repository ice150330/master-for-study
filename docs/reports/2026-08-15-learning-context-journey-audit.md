# 阶段 16：跨模块学习上下文审查报告

日期：2026-08-15
范围：统一深链参数、全局上下文路径、对象聚焦、浏览器历史与桌面视觉验收

## 1. 设计结论

此前各模块虽然已经能指向 Concept、Attempt 或来源对象，但参数命名、返回方式和目标聚焦彼此独立。用户进入练习或分析后，很难确认“我仍在处理哪个概念、从哪里来、如何回去”。本阶段把 URL 设为学习旅程的事实源，并在所有工作区顶部提供一条克制的上下文路径。

路径只表达四层信息：工作区、来源、Concept、当前模块；存在评测记录时再插入 Attempt。它不是新的主导航，也不复制业务内容。来源、概念和记录均可点击返回，右侧保留“返回来源”和退出上下文两个明确动作。

## 2. 成熟产品设计参考

| 官方资料 | 可复用形式 | 本项目落地 |
|---|---|---|
| [Visual Studio Code User Interface](https://code.visualstudio.com/docs/getstarted/userinterface) | Breadcrumbs 用紧凑层级表达当前文件在工作区中的位置，并可逐级跳转 | 在主标题下方加入全局学习路径，保持低视觉权重，来源、Concept 与 Attempt 均为可返回节点 |
| [Visual Studio Code Code Navigation](https://code.visualstudio.com/docs/editing/editingevolved) | 导航历史与定位目标配合，避免跳转后失去原上下文 | 目标对象带稳定 `data-context-focus`，深链进入后自动居中聚焦并短暂强调 |
| [MDN History.scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration) | 浏览器历史可选择手动恢复滚动位置 | App Router 外层是固定工作台，故按完整 URL 为内部滚动容器保存位置，前进/后退后恢复 |
| [MDN History.pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) | 将可序列化页面状态写入浏览器历史 | Concept、来源和 Attempt 全部写入查询参数，页面刷新、复制链接和历史回退使用同一状态 |

## 3. URL 合同

| 参数 | 示例 | 含义 |
|---|---|---|
| `workspace` | UUID | 当前学习工作区；未传时沿用本地默认工作区 |
| `concept` | UUID | 当前处理的规范知识对象 |
| `source` | `note:{id}` / `resource:{id}` / `message:{id}` | 进入当前旅程的来源证据 |
| `attempt` | `practice:{id}` / `interview:{id}` / `review:{id}` | 当前定位的评测或复习记录 |

统一解析器拒绝空 ID、未知类型和畸形引用；模块自己的选择参数（如 `note`、`resource`）继续保留，但会与统一学习上下文同步。

## 4. 交互闭环

- 聊天点击术语后写入 Concept 与消息来源，右侧知识轨道可继续创建笔记、练习或复习。
- 笔记与资源选择会同步来源；正文 Concept 链接和后续动作继续携带同一来源。
- 实践、面试与复习可通过 Attempt 深链直接恢复相应题目、反馈或 ReviewLog，并聚焦到目标区域。
- 成长分析的对象流水使用结构化来源和 Attempt 链接，返回后仍保留时间范围、筛选和滚动位置。
- 左侧全局导航切换模块时保留学习上下文；“退出当前学习上下文”只清除四个统一参数，不破坏模块本身状态。

## 5. 历史与焦点

Next.js 固定壳层复用同一个内部滚动容器，浏览器默认只处理 `window`，不能恢复这里的 `scrollTop`。实现采用三步：用户导航前同步快照、静止 80ms 后持久化普通滚动、路由进入后两帧加一次延迟恢复。卸载阶段不再保存，避免路由归零覆盖来源位置。

只有首次进入且没有历史位置时才聚焦上下文对象；存在历史快照时优先恢复用户原位置。焦点强调尊重 `prefers-reduced-motion`，减少动态偏好下不播放高亮动画。

## 6. 截图审查

截图目录：`data/ui-captures/16-learning-context-journey/`

- `01-note-*`：笔记来源、Cache-Control 与当前模块路径一致，目标笔记聚焦。
- `02-practice-*`：跨到实践区后来源与 Concept 未丢失。
- `03-analytics-*`：分析页仍显示同一上下文，首屏信息无挤压。
- `04-history-restored-*`：离开分析页再后退，恢复到原内部滚动位置。
- `05-review-*`：ReviewLog 深链定位到对应历史记录。
- `06-chat-*`：回到对话后打开同一 Concept 轨道及来源链。

视觉复盘：1440 下上下文条保持次级，不与页面标题争夺注意力；1024 下图标侧栏、路径和三栏内容无重叠。对话 Concept 轨道在 1024 使用覆盖式工作面板，未为手机端增加额外交互分支，符合本项目桌面优先范围。

## 7. 验证结果

- 纯函数单测覆盖上下文解析、非法值拒绝、参数合并与聚焦引用。
- Playwright 真实执行笔记 → 实践 → 分析 → 浏览器后退/前进 → 复习 → 对话完整旅程。
- 1440×900 与 1024×768 均验证 URL 保留、目标焦点、滚动恢复和视觉无覆盖。
- 本阶段不改数据库结构，不需要迁移。

## 8. 后续衔接

阶段 17 进行系统级键盘、焦点、对比度、减少动态、缩放与桌面布局校准；阶段 18 再执行完整回归、截图索引与最终交付审查。
