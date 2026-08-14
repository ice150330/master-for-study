# Mentor · 本地 AI 学习老师

> 一个运行在本地、有长期记忆的私人学习老师——陪你学、帮你整理、看得见你的成长、在你遗忘前悄悄考你。

**当前状态**：阶段 0–18 已完成。应用已形成“今日行动 → 对话与语义分支 → Concept 来源轨道 → 笔记/资源 → SQL 实践或结构化面试 → FSRS 主动复习 → 证据化分析/知识图”的可运行学习闭环；统一 URL 上下文支持刷新、深链和浏览器历史恢复。实施记录见 [`docs/reports/`](docs/reports/) 与 [`CHANGES.md`](CHANGES.md)。

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| UI | Tailwind CSS v4 + Radix primitives + Lucide；React hooks + fetch 管理客户端状态 |
| AI | Vercel AI SDK v7（`ai`）+ `@ai-sdk/deepseek`（`v4-flash` 默认 / `v4-pro` 重任务） |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM |
| 学习引擎 | sql.js Web Worker 沙盒 + ts-fsrs FSRS 6 + React Flow 知识图 |
| 测试 | Vitest（纯函数、SQLite、Route 合同）+ Playwright + axe-core |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置密钥（DeepSeek API key，仅存 .env，勿提交）
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 3. 启动开发服务器
npm run dev
```

打开 <http://localhost:3000> 查看。SQLite 数据文件 `data/mentor.db` 在首次查询时自动创建并迁移，无需手动建库。

## 常用命令

```bash
npm run dev     # 开发服务器（Turbopack）
npm run build   # 生产构建
npm run start   # 生产启动（需先 build）
npm run lint    # ESLint
npm test        # Vitest 单次运行
npx vitest run tests/fsrs.test.ts   # 跑单个测试文件
npx playwright test --config=config/playwright.config.ts --project=desktop-1440x900
npx playwright test tests/e2e/final-learning-loop.spec.ts --config=config/playwright.config.ts
npx drizzle-kit generate            # 改 schema 后生成迁移（drizzle/，运行时自动应用）
```

## 项目结构

```
src/
├── app/              # 路由 + API route handlers
│   └── api/          # chat / sessions / terms / notes / interview / review / resources / events
├── components/       # 组件（chat / notes / interview / review / analytics / whiteboard / resources / practice）
└── lib/              # AI、DB、FSRS、学习上下文、知识图、分析与实践领域逻辑
tests/
├── api/ / db/        # Route 合同与临时 SQLite 集成测试
└── e2e/              # Playwright 交互、截图、无障碍和闭环测试
config/               # Playwright 等项目配置
data/                 # SQLite、截图与测试产物（gitignore）
drizzle/              # 迁移 SQL（已提交）
docs/plans/           # 产品蓝图与实施计划
docs/reports/         # 各阶段设计、截图与验证审计
```

路径别名 `@/*` → `src/*`。

## 文档

- [AGENTS.md](AGENTS.md) —— 代码规范与关键约束（含 Next.js 16 破坏性变更提示）
- [CLAUDE.md](CLAUDE.md) —— Claude Code 工作指引（命令 + 架构大图）
- [DESIGN.md](DESIGN.md) —— 桌面学习工作台 UI/UX 设计系统
- [CHANGES.md](CHANGES.md) —— 变更记录
- [docs/plans/](docs/plans/) —— 产品设计蓝图与实施计划
- [docs/reports/](docs/reports/) —— 阶段审查与最终交付报告

## 许可证

[MIT](LICENSE)
