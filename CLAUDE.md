# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 项目概况

Mentor —— 本地 AI 学习老师。Next.js 16 (App Router + Turbopack) 全栈应用。

**当前处于初期骨架阶段**：只落地了 Next.js 16 + React 19 + TypeScript + Tailwind v4 骨架和 card-stack 设计令牌，`src/` 下仅有一个静态首页。聊天、AI、数据库、白板等业务功能均未实现——`AGENTS.md` 技术栈表里除框架/UI 外的依赖（`ai`、`@ai-sdk/deepseek`、`better-sqlite3`、`drizzle-orm`、`zustand`、shadcn/ui）尚未安装。

> ⚠️ 这是 **Next.js 16.3.0**——有破坏性变更的版本，API、约定、文件结构都可能与训练数据不同。写任何 Next.js 代码前，先读 `node_modules/next/dist/docs/` 下对应主题的文档并留意弃用提示。当前代码已用类型化路由（如 `layout.tsx` 的 `LayoutProps<"/">`）。

## 常用命令

```bash
npm run dev     # 启动开发服务器（Turbopack）
npm run build   # 生产构建
npm run start   # 生产启动（需先 build）
npm run lint    # ESLint（eslint-config-next）
```

- 无测试框架、无 `test` 脚本；要跑测试需先自行引入。
- 依赖安装用 npm（有 `package-lock.json`）。

## 架构大图

路径别名 `@/*` → `src/*`（`tsconfig.json`）。路由在 `src/app/`（含 `api/` route handlers），组件在 `src/components/`，领域逻辑在 `src/lib/`（ai / db / memory / fsrs / terms）。

以下设计贯穿多个模块，需要读多份文档才能拼出全貌：

1. **事件溯源**：一切学习行为写入不可变的 `LearningEvent` 事件流（`lib/db/schema.ts`）。成长曲线、遗忘曲线、知识盲区都从事件流聚合得出，不单独存结果。计划中的表：`Workspace` / `Session`（`parent_id` 构成会话树）/ `Message` / `Term` / `TermMastery` / `LearningEvent`。
2. **术语标注两段式**：正文用 `[[术语]]` 内联标记流式返回（规避流式偏移错位），术语结构化清单用 `generateObject` 二次提取；前端 `components/chat/` 把 `[[term]]` 解析成高亮组件。
3. **单源卡片**：术语 / 会话 / 知识点是同一张卡片，多视图"引用"而非复制。
4. **记忆贯穿**：所有模块共享同一份记忆读写，形成闭环。
5. **AI 接入**：`lib/ai/provider.ts` 封装 DeepSeek 双模型 `fastModel`（v4-flash，默认）/ `proModel`（v4-pro，重任务），走 Vercel AI SDK。

## 设计令牌

card-stack 风格令牌定义在 `src/app/globals.css` 的 `@theme inline`（Tailwind v4），直接可用 `bg-background` / `bg-primary` / `text-foreground` 等类。完整规范（颜色、圆角、阴影、组件约定）见 `DESIGN.md`。

其余代码规范与关键约束（密钥安全、better-sqlite3 仅服务端、`serverExternalPackages` 配置、注释中文、目录归位、变更追加 `CHANGES.md`）见 `AGENTS.md`。
