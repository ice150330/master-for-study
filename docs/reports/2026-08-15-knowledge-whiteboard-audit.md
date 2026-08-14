# 阶段 14：可操作局部知识图验收

## 设计依据

- Obsidian 官方 Local Graph 围绕当前笔记显示关联对象，并允许按深度扩展；全局图与局部图共享搜索、过滤、缩放和平移能力。本阶段采用“当前 Concept + 一/二跳”作为默认认知尺度，而不是直接铺开全局图。
- React Flow 官方提供可访问节点、缩放/平移、Controls、MiniMap 和 fitView；其布局指南明确区分树与非树图，并提示大图持续力模拟的性能成本。本阶段使用 React Flow 负责成熟交互，局部图使用确定性分环布局，不运行持续物理模拟。
- 参考资料：[Obsidian Graph View and Local Graph](https://obsidian.md/help/plugins/graph)、[React Flow Controls](https://reactflow.dev/api-reference/components/controls)、[React Flow Components](https://reactflow.dev/api-reference/components)、[React Flow Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)、[React Flow Layouting](https://reactflow.dev/learn/layouting/layouting)。

## 功能结果

- 新增 `knowledge_nodes`、`knowledge_edges` 和 `knowledge_node_layouts`，把语义对象、带证据关系和用户画布坐标分开保存；页面不再读取硬编码后端技能树。
- 首次访问把领域种子写入数据库，并将真实 Concept 合并到同名种子节点；未接触的种子不会创建 term、review card 或学习事件。
- 同一消息、笔记或资源中共同出现的 Concept 生成稳定的 `related` 边与权重，刷新时做差异同步，不全删重建。
- 默认围绕最近且有关系的真实 Concept 显示一跳；可切两跳、搜索并重新居中、按属于/前置/相关/应用于过滤。
- React Flow 画布支持滚轮缩放、拖拽平移、控制器适配视图、MiniMap 导航和键盘聚焦；Concept 节点可拖动，坐标与 LearningEvent 同事务持久化。
- 节点卡固定为 184×68，长名称省略且有 title；一跳自动完整入框，二跳保持最小 0.8 缩放，不把大图缩成不可读缩略图。
- 右侧轨道显示定义、掌握状态、对话/笔记/资源/面试/实践/复习证据、直接关系和学习动作；关系节点可成为新中心。
- 会话分支复用同一画布，节点链接包含 session 和 `forkedFromMessageId`，可回到具体会话与分叉消息。

## 数据迁移

- `0013` 新建三张知识图表及节点标签/term、语义关系、布局唯一索引。
- 真实库迁移前完成 WAL checkpoint，并备份到 `data/backups/mentor-before-phase14-20260815-0321.db`；备份与迁移前主库 SHA256 一致。
- 真实库迁移后共 14 条迁移；首次投影得到 36 个知识节点和 14 条种子边，术语与 ReviewCard 均保持 26 条，证明种子未污染学习队列；`quick_check=ok`，外键检查为空。

## 截图审查

截图位于 `data/ui-captures/14-knowledge-whiteboard/`，不进入 Git。

- `local-one-hop`：中心与三类直接关系完整入框，节点轨道和底部动作均在首屏。
- `two-hop-fit`：九节点保持可读字号，边缘节点允许平移访问，MiniMap 显示节点与当前视口。
- `node-evidence`：选择节点后轨道切换到该 Concept，图形尺寸与相机位置稳定。
- `relation-filter`：四类关系以复选菜单组织，不占用常驻画布空间。
- `session-branches`：会话图保持根/派生语义，直接关系与返回入口清晰。

五个 `1440x900` 状态经三轮人工截图复核；首次发现的 fit 动画中间帧裁切和 MiniMap 无节点问题均已修正。相同流程另在 `1024x768` 通过基础可用性门禁，未做移动端逐状态精修。

## 自动验证

- 纯函数测试覆盖一/二跳分环、坐标互异和保存坐标优先。
- SQLite 集成测试覆盖真实 Concept 同步、两组来源形成二跳关系、证据计数、种子幂等、布局事件幂等和会话 fork 链接。
- Playwright 在 1440 与 1024 验证搜索、重定中心、深度、九节点/MiniMap、节点轨道、关系筛选与会话图。
- TypeScript、ESLint、全量 Vitest、SQLite 完整性与 Next.js production build 作为提交前质量门执行。
