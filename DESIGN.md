# DESIGN.md · UI/UX 设计系统

> 本项目采用 **card-stack** 设计风格：深紫黑背景 + 高饱和紫/青/粉/黄点缀色 + 圆角卡片堆叠。

## 1. 设计令牌（Design Tokens）

### 1.1 颜色

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--background` | `#1a1a2e` | 深紫黑背景 |
| `--foreground` | `#fafafa` | 浅色前景文字 |
| `--card` | `#f0f0f5` | 浅色内容卡片 |
| `--card-soft` | `#f7f7fc` | 更浅的卡片 |
| `--primary` | `#6c5ce7` | 紫色主色（品牌色） |
| `--accent` | `#00cec9` | 青色强调 |
| `--pink` | `#fd79a8` | 粉色点缀 |
| `--yellow` | `#ffeaa7` | 黄色点缀 |
| `--muted` | `#a1a1aa` | 弱化文字 |
| `--border` | `rgba(255,255,255,0.12)` | 半透明边框 |

### 1.2 圆角

| 场景 | 值 |
|------|-----|
| 小控件 / 按钮 | 8–10px |
| 卡片 | 12–16px |
| 大卡片 | 20px |
| 圆形 / 头像 | 50% |

### 1.3 阴影

- 卡片投影：`rgba(0,0,0,0.12)` ~ `rgba(0,0,0,0.35)`
- 卡片堆叠层次：`rgba(26,26,46,0.06)` ~ `rgba(26,26,46,0.15)`

### 1.4 字体

| 场景 | 字体 |
|------|------|
| 正文 / UI | Geist Sans |
| 代码 / 等宽 | Geist Mono |

## 2. Tailwind 映射

令牌已落地到 `src/app/globals.css` 的 `@theme`，可直接用以下类名：

- 背景：`bg-background` `bg-card` `bg-card-soft` `bg-primary` `bg-accent` `bg-pink` `bg-yellow`
- 文字：`text-foreground` `text-muted`
- 边框：`border-border`

## 3. 组件规范

| 组件 | 规范 |
|------|------|
| 卡片 | `rounded-2xl` + 阴影，浅色卡片用 `bg-card` |
| 按钮 | 主操作 `bg-primary`，次操作 `bg-accent`，圆角 `rounded-xl` |
| 术语高亮 | 用点缀色（accent/pink/yellow）+ 下划线，hover 显示解释弹窗 |
| 输入框 | `bg-card` + `border-border` + `rounded-xl` |

## 4. 视觉原则

1. **深底浅字**：深紫黑背景承载浅色内容，营造沉浸感
2. **点缀克制**：紫/青/粉/黄仅用于强调与区分，不铺满
3. **卡片堆叠**：用圆角卡片 + 阴影分层，信息以"卡片"为单位组织
