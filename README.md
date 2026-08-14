# Mentor · 本地 AI 学习老师

> 一个运行在本地、有长期记忆的私人学习老师——陪你学、帮你整理、看得见你的成长、在你遗忘前悄悄考你。

**当前状态**：八大模块已完成——流式对话（术语标注 + 高亮 + 会话树）、学习笔记（结构化总结 + 导出）、模拟面试（出题 + 判分）、隐性巩固（间隔重复）、成长分析（仪表盘）、白板（会话关系图 + 成长地图）、资源库（按术语组织 + 阅读状态）、实践区（SQL WASM 沙盒）。规划见 [`docs/plans/`](docs/plans/) 与 [`todo.md`](todo.md)。

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| UI | Tailwind CSS v4（shadcn/ui 与 Zustand 为规划项，尚未引入） |
| AI | Vercel AI SDK v7（`ai`）+ `@ai-sdk/deepseek`（`v4-flash` 默认 / `v4-pro` 重任务） |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM |
| 实践沙盒 | sql.js（WASM，客户端运行 SQL） |
| 测试 | Vitest（`lib/` 纯函数单测） |

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
npx drizzle-kit generate            # 改 schema 后生成迁移（drizzle/，运行时自动应用）
```

## 项目结构

```
src/
├── app/              # 路由 + API route handlers
│   └── api/          # chat / sessions / terms / notes / interview / review / resources / events
├── components/       # 组件（chat / notes / interview / review / analytics / whiteboard / resources / practice）
└── lib/              # 领域逻辑
    ├── ai/           # provider（双模型）/ term-annotation（两段式）/ note / interview
    ├── db/           # schema + 仓库层（所有 SQL 只出现在这里）
    ├── fsrs.ts       # 间隔重复调度器
    ├── session-tree.ts / term-parse.ts / tree-layout.ts / skill-tree.ts
tests/                # Vitest 纯函数单测
data/                 # SQLite 数据文件（gitignore）
drizzle/              # 迁移 SQL（已提交）
docs/plans/           # 产品设计蓝图 + 实施计划
```

路径别名 `@/*` → `src/*`。

## 文档

- [AGENTS.md](AGENTS.md) —— 代码规范与关键约束（含 Next.js 16 破坏性变更提示）
- [CLAUDE.md](CLAUDE.md) —— Claude Code 工作指引（命令 + 架构大图）
- [DESIGN.md](DESIGN.md) —— UI/UX 设计系统（card-stack 设计令牌）
- [CHANGES.md](CHANGES.md) —— 变更记录
- [docs/plans/](docs/plans/) —— 产品设计蓝图与实施计划

## 许可证

[MIT](LICENSE)
