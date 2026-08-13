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
| UI | Tailwind CSS v4 + shadcn/ui |
| AI | Vercel AI SDK (`ai`) + `@ai-sdk/deepseek`（`v4-flash` 默认 / `v4-pro` 重任务） |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM |
| 状态 | Zustand |

## 项目结构

```
src/
├── app/              # 路由 + API route handlers
│   └── api/          # chat / sessions / notes / interview / quiz
├── components/       # 组件（chat / whiteboard / interview / review / ui）
└── lib/              # ai（provider/标注）、db（schema）、memory、fsrs、terms
docs/plans/           # 产品设计蓝图 + 实施计划
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
