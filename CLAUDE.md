# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 项目概况

Mentor —— 本地 AI 学习老师。Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 全栈应用。AI 走 DeepSeek（Vercel AI SDK v7 + zod），数据落本地 SQLite（better-sqlite3 + Drizzle ORM）。

规划的各模块均已落地（实践区已于 2026-08-15 下线、2026-08-24 正式除名，历史练习事件与 Attempt 数据保留供分析聚合），每模块 = 页面（`src/app/<模块>/page.tsx`）+ 视图组件（`src/components/<模块>/`）+ 数据通道：

| 模块 | 页面 | 数据通道 |
|------|------|---------|
| 今日学习 | `/today` | Server Component 直调 `lib/db`（`force-dynamic`），无 API route |
| 流式对话（术语标注 + 会话树） | `/` | `/api/chat`（流式）、`/api/sessions[/id]`、`/api/terms` |
| 学习笔记 | `/notes` | `/api/notes` |
| 模拟面试 | `/interview` | `/api/interview` |
| 隐性巩固（间隔重复） | `/review` | `/api/review` |
| 成长分析 | `/analytics` | Server Component 直调 `lib/db`（`force-dynamic`），无 API route |
| 白板（会话关系图 + 成长地图） | `/whiteboard` | 同上，服务端直调 |
| 资源库 | `/resources` | `/api/resources` |

> AGENTS.md 技术栈表里的 Zustand 与 shadcn/ui **尚未安装**：客户端状态目前是 React hooks + fetch，UI 是手写 Tailwind 组件。勿照表引入。

> ⚠️ 这是 **Next.js 16.3.0**——有破坏性变更的版本。写任何 Next.js 代码前，先读 `node_modules/next/dist/docs/` 下对应主题的文档。已启用类型化路由（如 `layout.tsx` 的 `LayoutProps<"/">`、`RouteContext<'/api/sessions/[id]'>`）。

## 常用命令

```bash
npm run dev     # 开发服务器（Turbopack）
npm run build   # 生产构建
npm run start   # 生产启动（需先 build）
npm run lint    # ESLint（eslint-config-next）
npm test        # Vitest 单次运行
npx vitest run tests/fsrs.test.ts   # 跑单个测试文件
npx vitest run -t "遗忘"             # 按用例名过滤
```

- Vitest **无配置文件**：`@/` 别名在测试里不可解析，测试用相对路径导入（`../src/lib/...`），新测试沿用此约定。
- 单元测试覆盖 `lib/` 纯函数（会话树、术语解析、FSRS 调度、树布局）；另有临时 SQLite 集成（`tests/db/`）与 Route 合同（`tests/api/`）；Playwright E2E 在 `tests/e2e/`（配置 `config/playwright.config.ts`）。

## 数据库（SQLite + Drizzle）

- 数据文件 `data/mentor.db`（已 gitignore，WAL 模式），迁移 SQL 落 `drizzle/`（已提交）。
- **懒加载单例**：`src/lib/db/index.ts` 首次真实查询时才建连接并跑 `migrate()`。勿在模块顶层主动开库——`next build` 多 worker 并发初始化会 SQLITE_BUSY。
- **改表流程**：改 `src/lib/db/schema.ts` → `npx drizzle-kit generate`（迁移进 `drizzle/`）→ 运行时首个查询自动应用。
- **仓库层模式**：所有 SQL 都走 `src/lib/db/index.ts` 导出的函数（`getSession` / `saveMessage` / `getDueReviews`…），route / 页面不手写查询。仅服务端可用。
- 当前只有一个默认工作区，`ensureWorkspace()` 自动创建。

## 架构大图

路径别名 `@/*` → `src/*`。以下设计贯穿多个模块，需读多份文件才能拼出全貌：

1. **事件溯源**：一切学习行为写不可变 `learningEvents` 流（`recordEvent()`），成长分析从事件流聚合，不单独存结果。现有事件类型：`message_sent` / `term_seen` / `reviewed` / `code_run`，新行为照此追加。表（workspaces / sessions / messages / terms / term_masteries / learning_events / notes / interviews / resources）见 `src/lib/db/schema.ts`。
2. **术语标注两段式**：
   - 流式正文：系统提示词要求名词内联 `[[术语]]`（规避流式下结构化 JSON 偏移错位）。`/api/chat` 返回**纯文本流**，前端 `parseTermMarkers`（`lib/term-parse.ts`）边收边解析成高亮 Term 组件，未闭合的尾部 `[[` 暂当普通文本。
   - 结构化清单：回答完成后前端调 `/api/terms`，`generateObject` + zod 二次提取 `[{ name, definition }]`，`upsertTerm` 入库并自动加入复习队列（`ensureMastery`）。
3. **单源卡片**：术语只存一份，复习队列 / 资源关联 / 成长地图都引用同一张 `terms` 表，不复制；知识图由 `lib/knowledge/` + `knowledge_nodes/edges/layouts` 数据库表驱动（React Flow 渲染，语义关系与画布布局分开保存）。
4. **会话树**：`sessions.parent_id` 自引用（null = 根）。`buildSessionTree`（`lib/session-tree.ts`，孤儿节点当根）组装，聊天侧边栏与白板 `TreeGraph`（`lib/tree-layout.ts` 纯函数布局 + SVG）共用。
5. **FSRS 间隔重复**：`lib/fsrs/scheduler.ts` 封装 ts-fsrs（FSRS 6，算法版本 `ts-fsrs-6@5.4.1`）；复习卡与掌握度存 `reviewCards` / `termMasteries`，每次评级不可变落 `reviewLogs`，`/review` 按到期出卡、评级前要求主动回忆。
6. **AI 接入**：`lib/ai/provider.ts` 双模型——`fastModel`（`deepseek-v4-flash`，默认）/ `proModel`（`deepseek-v4-pro`，重任务）。旧 ID `deepseek-chat` / `deepseek-reasoner` 已于 2026-07-24 下线。AI SDK 是 **v7**：流式响应用 `createTextStreamResponse` + `toTextStream`，v4 时代的 `toDataStreamResponse` 不存在。
7. **两种客户端数据通道**：交互页 = 客户端组件 + fetch API route；仪表盘 / 白板 = Server Component 直调仓库层（`export const dynamic = 'force-dynamic'`，本地 SQLite 每请求实时渲染）。
8. **全局壳与主题**：`components/shell/AppShell`（顶栏「学习|测验」大胶囊 + 组内子标签 + 全局工具 + 主题切换，分组配置在 `lib/nav.ts`，跨组记忆 localStorage）；主题 = globals.css 双套令牌（`:root` 纸白默认 / `.dark` 暖纸护眼），真相源是 `<html>.dark` 类，layout 防闪脚本首帧前定夺。**卡片内部文字用 `text-card-foreground`、彩色填充上用配对 `*-foreground`**（暖纸主题卡是浅色，`text-foreground` 在卡上不可见）。
9. **会话卡片堆**：聊天页 = SessionDeck（当前会话大卡片 + 祖先链左侧竖条堆 + 分支右上卡片扇 + SessionPicker 弹层树），Chat.tsx 只是状态容器。SVG 颜色走 `var(--令牌)` + style 对象（presentation attribute 不吃 var()）。

## 排障备忘

- **DeepSeek 401**：Next.js 不覆盖 shell 中已存在的环境变量——若终端里 `DEEPSEEK_API_KEY` 是无效旧值，会盖掉 `.env` 里的有效 key。清掉该环境变量再启动。

## 设计令牌与规范

手绘纸张风令牌（纸白/暖纸底 + 墨黑虚线 + 红/青/黄 marker + 纸影/胶带，参考 StyleKit Hand-drawn Doodle）定义在 `src/app/globals.css` 的 `@theme inline`（Tailwind v4），直接用 `bg-background` / `bg-card` / `text-foreground` / `text-muted` 等类。完整规范见 `DESIGN.md`。

其余约束（密钥只存 `.env`、better-sqlite3 仅服务端 + `serverExternalPackages`、注释中文、目录归位、变更追加 `CHANGES.md`）见 `AGENTS.md`。
