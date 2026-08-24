<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# 项目代码设计规范与约束

> 本地 AI 学习老师（Mentor）——一个运行在本地、有长期记忆的私人学习老师。

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| UI | Tailwind CSS v4（组件手写；shadcn/ui 与 Zustand 为规划项，**尚未安装**，客户端状态用 React hooks + fetch） |
| AI | Vercel AI SDK v7（`ai`）+ `@ai-sdk/deepseek`（`v4-flash` 默认 / `v4-pro` 重任务），校验用 zod |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM，仓库层在 `src/lib/db/index.ts` |
| 测试 | Vitest（纯函数、临时 SQLite、Route 合同）+ Playwright（`config/playwright.config.ts`）+ axe-core |

## 项目结构

```
src/
├── app/              # 路由 + API route handlers
│   └── api/          # chat / sessions / terms / notes / interview / practice / review / resources / events
├── components/       # 组件（today / chat / notes / interview / review / analytics / whiteboard / resources）
└── lib/              # ai（provider/两段式标注/note/interview）、db（schema + 仓库层）、
                     # fsrs、session-tree、term-parse、tree-layout、skill-tree
tests/                # Vitest 单元/集成/合同测试 + Playwright E2E
config/               # Playwright 等项目配置
data/                 # SQLite、截图与测试产物（gitignore，首次查询自动建库迁移）
drizzle/              # 迁移 SQL（已提交；改 schema 后 npx drizzle-kit generate）
docs/plans/           # 产品设计蓝图 + 实施计划
docs/reports/         # 阶段截图审查与验证报告
```

## 代码规范

- **注释用中文**，代码标识符用英文
- **目录归位**：计划→`docs/plans/`，脚本→`scripts/`，配置→`config/`，数据→`data/`，测试→`tests/`
- 变更后追加到 `CHANGES.md`

## 关键约束

1. **密钥安全**：DeepSeek key 只存 `.env`（已 gitignore），绝不硬编码进代码或提交
2. **better-sqlite3 仅服务端**：仅在 API route / server 侧引用，已配置 `serverExternalPackages`
3. **术语标注两段式**：正文用 `[[术语]]` 内联标记流式返回，术语结构化清单用 `generateObject` 二次提取
4. **数据可溯源**：一切学习行为写入 `LearningEvent` 事件流
