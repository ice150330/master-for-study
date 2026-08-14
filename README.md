# Mentor · 本地 AI 学习老师

> 一个运行在本地、有长期记忆的私人学习老师——陪你学、帮你整理、看得见你的成长、在你遗忘前悄悄考你。

**当前状态**：核心链路已跑通——流式对话、术语标注与高亮、会话树与 SQLite 持久化（阶段 0 + 1）。其余模块（白板 / 面试 / 隐性巩固 / 成长分析 / 资源库 / 实践区）待开发，规划见 [`docs/plans/`](docs/plans/) 与 [`todo.md`](todo.md)。

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| AI | Vercel AI SDK (`ai`) + `@ai-sdk/deepseek`（`v4-flash` 默认 / `v4-pro` 重任务） |
| 数据库 | SQLite（better-sqlite3）+ Drizzle ORM |
| 状态 | Zustand |

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

打开 <http://localhost:3000> 查看。

## 常用命令

```bash
npm run dev     # 开发服务器（Turbopack）
npm run build   # 生产构建
npm run start   # 生产启动（需先 build）
npm run lint    # ESLint
```

## 项目结构

```
src/
├── app/              # 路由 + API route handlers（api/: chat / sessions / notes / interview / quiz）
├── components/       # 组件（chat / whiteboard / interview / review / ui）
└── lib/              # ai（provider/标注）、db（schema）、memory、fsrs、terms
docs/plans/           # 产品设计蓝图 + 实施计划
```

路径别名 `@/*` → `src/*`。

## 文档

- [AGENTS.md](AGENTS.md) —— 代码规范与关键约束（含 Next.js 16 破坏性变更提示）
- [DESIGN.md](DESIGN.md) —— UI/UX 设计系统（card-stack 设计令牌）
- [CHANGES.md](CHANGES.md) —— 变更记录
- [docs/plans/](docs/plans/) —— 产品设计蓝图与实施计划

## 许可证

[MIT](LICENSE)
