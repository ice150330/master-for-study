# DESIGN.md · UI/UX 设计系统

> **双主题 card-stack 风格**：默认浅色（浅灰白底 + 品牌紫 #6c5ce7 点缀），一键切换深色（深紫黑底 + 浅色卡片堆叠，延续初版气质）。

## 1. 主题机制

- **令牌双套**：`src/app/globals.css` 中 `:root` 定义浅色默认值，`.dark { … }` 覆盖同名变量，经 `@theme inline` 映射为 Tailwind 类（`bg-card` / `text-muted` …），组件类名不随主题变化。
- **切换**：真相源是 `<html>` 上的 `.dark` 类。`layout.tsx` 注入阻塞式内联脚本，首帧渲染前按 `localStorage['mentor-theme']` 决定（**无记录 = 浅色默认**）；`ThemeToggle`（顶栏右侧）负责切换与持久化，图标由 `dark:` 变体控制，无客户端状态。
- **暗色变体**：`@custom-variant dark (&:where(.dark, .dark *))`，个别场景可用 `dark:hidden` 等类特判。

## 2. 设计令牌（浅色 / 深色）

| 令牌 | 浅色（默认） | 深色 | 用途 |
|------|------------|------|------|
| `--background` | `#f6f6fa` | `#1a1a2e` | 页面底色 |
| `--foreground` | `#1c1c2e` | `#fafafa` | 页面级文字 |
| `--surface` | `#ececf4` | `rgba(255,255,255,0.04)` | 分区块底（列表行、图表面板） |
| `--card` | `#ffffff` | `#f0f0f5` | 卡片底色 |
| `--card-soft` | `#f1f1f8` | `#f7f7fc` | 卡片内嵌区（输入底、代码块、气泡） |
| `--card-foreground` | `#1c1c2e` | `#1a1a2e` | **卡上文字**（卡片内一律用它） |
| `--primary` | `#6c5ce7` | `#6c5ce7` | 品牌紫（填充与文字均可，白底对比 4.9:1） |
| `--primary-foreground` | `#ffffff` | `#fafafa` | 紫底上文字 |
| `--accent` | `#0a7d78` | `#00cec9` | 青色强调（浅色加深保 AA） |
| `--accent-foreground` | `#ffffff` | `#1a1a2e` | 青底上文字 |
| `--pink` | `#c94077` | `#fd79a8` | 粉色点缀 |
| `--pink-foreground` | `#ffffff` | `#1a1a2e` | 粉底上文字 |
| `--yellow` | `#f5c542` | `#ffeaa7` | 黄色（**仅作填充**） |
| `--yellow-foreground` | `#5c4708` | `#1a1a2e` | 黄底上文字 |
| `--muted` | `#71717a` | `#a1a1aa` | 弱化文字 |
| `--border` | `rgba(28,28,46,0.12)` | `rgba(255,255,255,0.12)` | 描边 |
| `--state-untouched` / `-fg` | `#e9e9f0` / `#71717a` | `#2a2a3e` / `#a1a1aa` | 白板「未接触」节点 |

**语义规则（写组件时必守）**：
1. 卡片内部文字一律 `text-card-foreground`，不用 `text-foreground`（深色主题卡是浅色）
2. 彩色填充上的文字用对应 `*-foreground`（`bg-primary` → `text-primary-foreground`）
3. 黄色不作文字色（浅色下对比度不足），只作填充
4. 页面级文字（标题、分区块内）才用 `text-foreground`

## 3. 圆角 / 阴影 / 字体

| 场景 | 值 |
|------|-----|
| 小控件 / 按钮 / 胶囊 | `rounded-full` 或 `rounded-lg`(8px) |
| 卡片 | `rounded-2xl`(16px) |
| 会话大卡片 | `rounded-3xl`(24px) |
| 卡片投影 | `shadow-md` ~ `shadow-xl` |

字体：正文 Geist Sans，代码 Geist Mono（`next/font` 变量注入）。

## 4. 导航（AppShell 全局壳）

顶栏 `h-14`（毛玻璃 `bg-background/80 backdrop-blur`）+ 单滚动内容区：

```
[ Mentor ] ( 大胶囊: [学习|测验] ) [ 聊天 笔记 资源库 实践区 ]      [成长分析] [白板] [🌙]
   品牌        分组 segmented          组内子标签(下划线)             全局工具      主题
```

- **大胶囊**：`bg-surface` 圆角容器包裹两个小胶囊；激活小胶囊 = `bg-card` 浮起 + 阴影
- **分组归属**：学习 = 聊天 / 笔记 / 资源库 / 实践区；测验 = 模拟面试 / 复习；成长分析与白板为全局工具（不属组、无子标签）
- **跨组记忆**：切换胶囊回到该组上次访问页（`localStorage['mentor-nav:last:<组>']`，仅采纳组内合法路由）
- **模块页版心**：统一用 `PageShell`（`title / description / actions / width: sm|md|lg`），禁止再手写页头

## 5. 会话卡片堆（SessionDeck）

一个会话 = 一张卡片，全部卡片可互相切换：

| 元素 | 形态 | 交互 |
|------|------|------|
| 当前会话 | `rounded-3xl` 大卡片（标题栏+血缘提示+模型切换 / 消息流 / 输入区） | 对话主舞台 |
| 祖先链 | 主卡左侧**竖条卡片**向左后方堆叠（竖排标题，透明度递减；最多 3 张，更深折叠「⋯」链表） | 点竖条回跳该会话 |
| 分支子会话 | 主卡右上角**小卡片扇**（逐张下沉+微旋转；最多 3 张，更多折叠 `+N`） | 点小卡切入分支 |
| 全部会话 | 工具行「会话列表」弹层树（收纳旧侧边栏能力，其它根会话可达） | 点条目切换 |
| 新话题 | 工具行紫色按钮 | 新建根会话并打开 |

- 派生语义：术语弹窗「分支会话」后，新卡成为当前卡、原卡退为左侧竖条——堆叠即血缘
- 术语弹窗三选项（分支会话 / 新会话 / 追问）不变，`z-30` 高于卡片堆
- 模型切换：卡片标题栏「闪电(v4-flash) / 深思(v4-pro)」小胶囊，`localStorage['mentor-model']` 记忆

## 6. 组件规范

| 组件 | 规范 |
|------|------|
| 卡片 | `rounded-2xl bg-card shadow-md`；内嵌区 `bg-card-soft` |
| 按钮 | 主操作 `bg-primary text-primary-foreground`；次操作 `bg-surface text-foreground`；胶囊 `rounded-full` |
| 术语高亮 | `text-accent` + 点下划线，hover 弹窗 `bg-card` + `z-30` |
| 输入框 | `bg-card-soft border-border rounded-xl focus:border-primary`，placeholder `text-card-foreground/50` |
| SVG 图表 | 颜色走 `var(--令牌)` 经 style 对象注入（presentation attribute 不支持 var()）；连线用 `className="stroke-border"` |

## 7. 视觉原则

1. **浅底为主、深色可退**：默认浅色专业干净，深色延续品牌沉浸感
2. **点缀克制**：紫为主角，青/粉/黄只做强调与状态，不铺满
3. **卡片即对象**：信息以卡片为单位组织，卡片堆叠表达会话血缘
4. **对比度兜底**：任何填充上的文字都有配对 `*-foreground`，两主题 AA 达标
