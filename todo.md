# TODO · Mentor 开发计划

> 细致可勾选的开发任务清单。范围 = **核心链路**：本地启动 → 流式对话 → 术语标注 → 派生子会话 → 数据落库。
> 对应 `docs/plans/2026-08-13-项目初期实施计划-design.md` 的阶段 0 + 阶段 1；八大模块中的白板 / 面试 / 隐性巩固 / 成长分析 / 资源库 / 实践区**不在本次范围**。

**完成标准（验收）**：`npm run dev` 启动无报错 → 流式对话逐字出现 → 术语高亮且悬停有「一句话解释 + 三选项」弹窗 → 能派生子会话且会话树父子/兄弟层级正确 → 刷新后历史会话与消息仍在。

**里程碑**：`M0 阶段0`（可独立交付：对话 + 术语标注）→ `M1 阶段1`（持久化 + 会话树，达成完整验收）。

---

## 前置准备 · 环境与依赖

- [ ] **P1. 读 Next.js 16 文档**：`node_modules/next/dist/docs/01-app/` 下 route handlers、streaming、`serverExternalPackages` 三篇。这是有破坏性变更的版本，动手前先确认当前 API 形态，勿凭记忆写。
- [x] **P2. 安装 AI 依赖**：`npm i ai @ai-sdk/deepseek zod`（AI SDK 实装 v7）
- [x] **P3. 安装数据库依赖**：`npm i better-sqlite3 drizzle-orm` + `npm i -D drizzle-kit @types/better-sqlite3`
- [ ] **P4. 安装状态/UI**：`npm i zustand`，初始化 shadcn/ui（`npx shadcn@latest init`，只引入会用到的组件）
- [x] **P5. 确认 DeepSeek 模型 ID**：映射为 `deepseek-chat`（快）/ `deepseek-reasoner`（重），见 `lib/ai/provider.ts`。
- [ ] **P6. 数据目录**：建 `data/` 目录存放 SQLite 文件，并把 `data/*.db` 加入 `.gitignore`。

---

## 阶段 0 · 骨架 + DeepSeek 对话 + 术语标注

- [x] **0.1 初始化项目**：Next.js 16 + TS + Tailwind v4 + card-stack 令牌（已完成）。
- [x] **0.2 配置密钥**：`.env`（`DEEPSEEK_API_KEY`）+ `.env.example` 占位（已完成，勿提交真实 key）。

- [x] **0.3 封装 provider** —— `src/lib/ai/provider.ts`
  - 导出 `fastModel`（默认）与 `proModel`（重任务），基于 P5 确认的模型 ID。
  - 读 key 用 `process.env.DEEPSEEK_API_KEY`，缺失时抛明确错误。
  - 验证：临时脚本调一次返回正常文本。

- [x] **0.4 流式对话 API** —— `src/app/api/chat/route.ts`
  - `export async function POST`，接收 `{ messages, model? }`。
  - 用 AI SDK `streamText` 返回流式响应（确认当前版本返回流的方式，如 `toDataStreamResponse`）。
  - 验证：`curl` 或页面逐字流式返回。

- [x] **0.5 术语标注两段式** —— `src/lib/ai/term-annotation.ts`
  - 第一段（流式正文）：prompt 要求正文中技术名词用 `[[术语]]` 内联包裹，规避流式偏移错位。
  - 第二段（结构化）：`generateObject` + zod 提取 `[{ name, definition }]` 术语清单，失败重试。
  - 验证：返回内容里术语被 `[[ ]]` 包裹，且附带结构化 terms。

- [x] **0.6 前端 Term 高亮** —— `src/components/chat/`
  - 流式解析器把 `[[term]]` 渲染成高亮/下划线组件（点缀色 accent/pink/yellow + 下划线，见 `DESIGN.md`）。
  - 验证：页面术语呈高亮样式。

- [x] **0.7 悬停弹窗** —— `src/components/chat/`（Term 组件 hover）
  - 显示一句话解释 + 「分支会话 / 新会话 / 追问」三选项（阶段 0 仅 UI，动作在 1.x 接上）。
  - 验证：悬停弹窗出现，选项可点（暂打桩）。

---

## 阶段 1 · 数据模型 + 会话树 + 持久化

- [ ] **1.1 建库建表** —— `src/lib/db/schema.ts` + `src/lib/db/index.ts`
  - 用 Drizzle 定义六张表，SQLite 文件落 `data/mentor.db`（服务端 only，已配 `serverExternalPackages`）：
    - `Workspace`：id / title / goal(成长目标) / created_at
    - `Session`：id / workspace_id / **parent_id(自引用，null=根)** / title / teacher_style / created_at / updated_at
    - `Message`：id / session_id / role(user|assistant) / content / created_at
    - `Term`：id / name(唯一) / definition(一句话) / created_at
    - `TermMastery`：id / term_id(唯一) / state(new|learning|reviewing|relearning) / stability / difficulty / due_at / last_reviewed_at
    - `LearningEvent`：id / type / entity_id / metadata(JSON) / created_at
  - 用 `drizzle-kit` 生成迁移并建表。
  - 验证：迁移后 `data/mentor.db` 生成，表结构正确。

- [ ] **1.2 会话 CRUD API** —— `src/app/api/sessions/route.ts`
  - 建会话 / 派生会话（带 `parent_id`）/ 查会话树（按 `parent_id` 组装父子层级）。
  - 验证：`curl` 建/派生/查，树结构正确。

- [ ] **1.3 消息持久化**
  - 对话时把用户/助手消息写入 `Message`；会话详情接口可回读历史。
  - 验证：刷新后历史对话仍在。

- [ ] **1.4 会话树侧边栏**
  - 侧边栏按 `parent_id` 展示会话树；接上 0.7 弹窗的「派生会话」动作。
  - 验证：派生子会话后侧边栏出现正确父子/兄弟层级。

---

## 收尾

- [ ] **测试**：引入测试框架（当前无 `test` 脚本），至少覆盖会话树组装、术语标注解析两个纯函数。
- [ ] **验收自查**：逐条对照「完成标准」跑一遍，记录运行证据。
- [ ] **追加 `CHANGES.md`**：按「倒序记录」约定记录本轮变更。

---

## 待决事项

- [ ] **应用名称**：当前占位「Mentor」，影响 `package.json` name、目录名、界面标题，需定稿后统一替换。
- [ ] **阶段交付节奏**：M0 完成后是否先跑给你看，还是 M0+M1 一起做完再验收（见原计划「待确认项」）。
