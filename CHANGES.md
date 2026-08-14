# CHANGES.md · 变更记录

> 倒序记录，每次修改后追加一条。

## 2026-08-15

- 完成学习闭环升级阶段 7：将术语演进为带规范名、别名、示例和置信度的 Concept，新增跨消息/笔记/资源来源 Mention；术语改为键盘可达触发器，聊天右侧接入多来源上下文轨道和继续追问、笔记、练习、复习动作，并完成键盘、加载、多来源截图验收
- 完成学习闭环升级阶段 6：会话新增根会话与消息锚点，分支创建只提交锚点并由服务端组装祖先共享前缀；术语和消息均可直接派生带首问的语义分支，补充卡片进场动效、1024 紧凑路径、上下文继承集成测试与分支前中后截图
- 完成学习闭环升级阶段 5：会话改为最近活动优先并按首问本地命名，新增搜索、重命名、置顶、归档恢复与确认删除；历史消息返回稳定状态和术语来源，输入区补齐停止、重新生成和继续回答，并通过桌面截图与完整会话生命周期测试
- 完成学习闭环升级阶段 4：为全部 Route Handler 建立 zod 运行时边界和统一错误结构，扩展版本化 LearningEvent，贯通会话、消息、术语、笔记、面试、复习、资源的幂等键与状态/事件同事务写入；新增 SQLite 迁移、临时库回滚测试和 API 合约测试
- 完成学习闭环升级阶段 3：建立统一客户端请求错误与超时结构，补充紧凑型局部反馈；聊天加入中止、请求序号和会话校验，资源、笔记、面试、复习改为失败可重试且保留输入；通过 400/500/超时单测、5 个桌面 Playwright 场景和 4 张状态截图验收

## 2026-08-14

- 完成学习闭环升级阶段 2：重构为桌面左侧分区导航、顶部上下文条、平板图标栏与基础移动底栏，新增 `/today` 行动入口、页面搜索、主题设置和上下文轨道能力
- 完成学习闭环升级阶段 1：收敛浅/深主题语义令牌，引入 Lucide 与按需 Radix primitives，建立按钮、字段、分段控制、Toast、Skeleton、空/错状态及开发视觉校验页
- 完成学习闭环升级阶段 0：引入 Playwright 四视口截图工具链，生成五个核心页面的 20 张视觉基线与布局审计，并形成桌面优先的现状审查报告
- 新增「学习闭环与前端交互升级」细粒度实施计划：明确学习工作台布局、上下文轨道、消息级分支、19 个实施阶段及桌面/移动端截图验收流程
- 同步实施计划中的 Next.js 版本（15 → 16.3.0）
- 补充 `README.md`（快速开始 + 常用命令 + 文档索引）
- 完善 `CLAUDE.md`（命令 + 架构大图 + 现状说明）
- 新增 `todo.md`（核心链路开发计划：阶段 0 + 阶段 1 细致任务清单）
- 完成阶段 0：DeepSeek provider、流式对话 API（`/api/chat`）、术语标注两段式（`/api/terms` + `[[术语]]` 内联）、术语高亮与悬停弹窗
- 完成阶段 1：Drizzle + better-sqlite3 六表数据模型、会话 CRUD 与消息持久化、学习事件流、会话树侧边栏
- 收尾：抽取会话树 / 术语解析两个纯函数到 `lib/`，引入 Vitest 并写单测（10 用例通过）
- 修正 DeepSeek 模型 ID：`deepseek-chat`/`deepseek-reasoner` → `deepseek-v4-flash`/`deepseek-v4-pro`（旧 ID 已于 2026-07-24 下线）
- 定位 401 根因：环境变量 `DEEPSEEK_API_KEY` 覆盖了 `.env` 中的有效 key（Next.js 不覆盖已存在的环境变量）
- 新增「学习笔记」模块：`/api/notes` + `/notes` 页，结构化总结（核心概念/术语/代码示例/未懂点）+ 导出 Markdown
- 新增「模拟面试」模块：`/api/interview` + `/interview` 页，出题 + 分层判分（advance/stay/downgrade）
- 重构 DB 连接为懒加载单例，避免 `next build` 多 worker 并发初始化 SQLite 造成 SQLITE_BUSY
- 新增「隐性巩固」模块：简化版 FSRS 调度器 + `/api/review` + `/review` 复习卡片页（术语自动入队，答后按评级排期）
- 新增「成长分析」模块：`/analytics` 仪表盘（术语掌握度分布、面试正确率、学习行为分布、最近活动）
- 新增「白板」模块：`lib/tree-layout.ts` 树布局引擎 + `TreeGraph` SVG 渲染器，`/whiteboard` 页展示会话关系图与个人成长地图（内置后端能力树 + 掌握度热力）
- 新增「资源库」模块：`resources` 表 + `/api/resources`（增/查/改状态）+ `/resources` 页（添加资源、按术语关联、想读/在读/已读状态）
- 新增「实践区」模块：sql.js（WASM）SQL 沙盒 + `/practice` 页（内置示例表、运行查询、code_run 事件落库）
- 更新 `CLAUDE.md`：同步八大模块落地现状、Vitest / Drizzle 常用命令与架构大图（旧版仍停留在骨架阶段描述）
- 全量文档同步：`README.md`（技术栈表标注未安装项、补 test / drizzle-kit 命令、项目结构改实际）、`AGENTS.md`（技术栈表 + 项目结构同步现状）、`todo.md`（补状态说明、401 根因更正、测试计数 4 文件 18 用例实测通过）、`docs/plans/` 两份文档头部状态行（蓝图标记愿景基线、实施计划标记已执行完成并列出选型出入）；`DESIGN.md` 与 `globals.css` 逐项核对一致，未改动
- 前端 UI/交互整体重构（纯前端，后端 API / DB 不动）：
- 主题系统：默认浅色 + 深色可切换——globals.css 重写为 `:root`(浅)/`.dark`(深) 双套令牌（新增 `card-foreground` / `*-foreground` / `surface` / `state-untouched` 语义令牌），`@custom-variant dark` 类策略，layout 防闪内联脚本 + `localStorage['mentor-theme']` 记忆
- 令牌语义迁移：9 文件 54 处 `text-background` → `text-card-foreground` 等，彩色填充统一配对 `*-foreground`，分区块底统一 `bg-surface`
- AppShell 全局壳：顶栏「学习|测验」大胶囊 + 组内子标签 + 右侧全局工具（分析/白板）+ ThemeToggle；跨组切换记忆上次页；新增 `lib/nav.ts` 导航配置与 `PageShell` 统一页头，8 个模块页去复制粘贴头、去星型导航
- SessionDeck 会话卡片堆替代侧边栏：当前会话大卡片 + 祖先链左侧竖条堆（点回跳，>3 折叠）+ 分支子会话右上角卡片扇（点切入，>3 折叠）+ SessionPicker 全部会话弹层树；Chat.tsx 拆分为 6 个组件（状态容器/舞台/大卡/祖先堆/分支扇/选择器），流式与术语逻辑原样保留
- 补上模型切换 UI：卡片标题栏「闪电/深思」小胶囊（接通后端已有 `model` 参数，localStorage 记忆）
- 白板主题化：TreeGraph 连线 `stroke-border`、节点走 `var(--令牌)` style 注入（SVG attribute 不支持 var()）；stateToStyle 未接触态/新发现态改令牌化
- 文档：DESIGN.md 全量重写（双主题令牌表 + 导航 + 卡片堆规范），CLAUDE.md 架构大图同步
- 验证：`npm test` 18/18、`npm run lint` 0 错、`npm run build` 通过、dev 全 8 路由 200

## 2026-08-13

- 初始化 Next.js 16 项目骨架（App Router + TypeScript + Tailwind v4）
- 落地 card-stack 设计令牌（深紫黑背景 + 紫/青/粉/黄点缀）
- 编写产品设计蓝图（八大模块）与项目初期实施计划（`docs/plans/`）
- 配置 DeepSeek API 环境变量（`.env`，已 gitignore）
- 补充 AGENTS.md / DESIGN.md / CHANGES.md 三份项目文档
