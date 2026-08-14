# CHANGES.md · 变更记录

> 倒序记录，每次修改后追加一条。

## 2026-08-14

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

## 2026-08-13

- 初始化 Next.js 16 项目骨架（App Router + TypeScript + Tailwind v4）
- 落地 card-stack 设计令牌（深紫黑背景 + 紫/青/粉/黄点缀）
- 编写产品设计蓝图（八大模块）与项目初期实施计划（`docs/plans/`）
- 配置 DeepSeek API 环境变量（`.env`，已 gitignore）
- 补充 AGENTS.md / DESIGN.md / CHANGES.md 三份项目文档
