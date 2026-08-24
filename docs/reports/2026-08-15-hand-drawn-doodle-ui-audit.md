# Hand-drawn Doodle 全量视觉替换审查

日期：2026-08-15

## 参考与结论

参考：[StyleKit Hand-drawn Doodle Showcase](https://www.stylekit.top/styles/hand-drawn-doodle/showcase)

该风格的纸张、墨线、marker 和手工错位与本地学习工作台的草稿、记忆、推演语义高度一致。风险是过度旋转、粗边框和装饰会伤害长文本、分析图表与知识图谱的扫描效率，因此采用“结构化手绘工作台”：材料和交互完整手绘化，内容几何保持稳定。

## 全量替换范围

- 全局：纸白/暖纸、横线和页边线、纸张纹理、墨黑虚线、红/青/黄 marker、胶带、折角、硬边纸影。
- 应用壳：侧栏、顶栏、当前导航、搜索、设置和纸张色温切换。
- 基础组件：按钮、图标按钮、输入、弹窗、Popover、菜单、Tooltip、Toast、分段控制、空/错/加载状态。
- 页面：今日、对话、笔记、资源、面试、复习、成长分析、知识白板。
- 对话专项：同尺寸纸卡直接堆叠，分支与祖先卡沿悬停抽出，按压下沉，进入/返回带方向落位；Concept 使用黄色 marker 与青色波浪线，悬停显示纸片定义。
- 清理：删除旧玻璃、模糊、夜景、泛光视觉和 `glass-*` 类语义；可见实践页保持下线。

## 人工截图审查

截图目录：`data/ui-captures/35-hand-drawn-doodle-audit/`

- 八个页面：`*-default-desktop-1440x900-after.png` 与 `*-default-tablet-1024x768-after.png`
- 会话堆叠：`*-before-desktop-1440x900.png`、`*-hover-stack-desktop-1440x900.png`、`*-hover-ancestor-desktop-1440x900.png`、`*-direct-stack-tablet-1024x768.png`
- Concept：`*-term-hover-desktop-1440x900.png`、`*-multi-source-desktop-1440x900.png`
- 辅助状态：`*-keyboard-focus-desktop-1440x900.png`、`*-loading-desktop-1440x900.png`

人工检查结论：纸面语法在八页一致；当前操作与层级可辨；长文本、输入区、图表刻度和白板节点未因装饰旋转；1440 与 1024 均无页面级横向溢出。白板审计中的 offscreen/clipped 项来自 React Flow 的可平移无限画布内部，不是文档溢出。

## 自动验证

- Playwright 视觉基线：桌面与 1024 共 16 张页面截图通过。
- Playwright 语义分支：悬停抽层 transform、可见操作、进入/返回和 1024 输入区通过。
- Playwright Concept：悬停定义、键盘打开、多来源轨道通过。
- Playwright 全量桌面/1024：33 项通过，23 项按不适用视口跳过，0 失败；包含 9 个关键路由 Axe 严重级扫描。
- Vitest：16 个文件、82 项通过。
- TypeScript：`npx tsc --noEmit` 通过。
- ESLint：`npm run lint` 通过。
- Next.js 16.3 production build：通过，`/practice` 不再生成可见页面路由。
- 运行路由：`/today` 返回 200，`/practice` 返回 404；开发服务保持在 `http://127.0.0.1:3000/`。
