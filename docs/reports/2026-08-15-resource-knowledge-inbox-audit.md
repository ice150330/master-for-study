# 阶段 13：资源知识输入箱验收

## 设计依据

- Zotero 将 URL、标识符与网页元数据作为资源入口，并把重复检测设计为合并而非静默创建副本；本阶段采用 URL 规范化、工作区唯一约束和重复条目概念/标签并集合并。
- Readwise Reader 以 Inbox、Later、Archive 组织阅读工作流，标签退居次级分类；本阶段映射为收件箱、在读、已完成三条主队列，并补搜索、类型与标签筛选。
- Readwise 的高亮保留来源位置、个人注释和标签；本阶段把摘录、定位和注释作为独立记录，同时让聊天只使用用户显式选择的资料。
- 参考资料：[Zotero Adding Items](https://www.zotero.org/support/adding_items_to_zotero)、[Zotero Duplicate Detection](https://www.zotero.org/support/duplicate_detection)、[Readwise Reader Library Configuration](https://docs.readwise.io/reader/guides/workflows/library-configuration)、[Readwise Highlights, Tags and Notes](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes)、[Readwise Search](https://docs.readwise.io/reader/docs/faqs/searching)。

## 功能结果

- 资源与 Concept 改为 `resource_terms` 多对多关系，保留旧 `term_id` 作为兼容投影；新增、编辑和重复合并都会同步 Concept Mention。
- URL 使用标准 URL API 归一化，删除 hash 和常见跟踪参数、统一主机名与路径；同工作区 canonical URL 唯一，重复保存返回原对象并合并新 Concept 与标签。
- 元数据端点提取标题、canonical、站点、作者、摘要、favicon 和资源类型；请求前解析 DNS 并拒绝内网/保留地址，重定向逐跳校验，限制 6 秒、600 KB 和内容类型；失败后表单保留 URL 并允许手工填写。
- 资源页改为桌面知识输入箱：收件箱/在读/已完成主视图，左侧队列、中央阅读资料、右侧状态轨道；支持搜索、类型、标签、编辑、删除、阅读进度和深链定位。
- 摘录作为独立记录保存原文、个人注释、章节/页码定位和标签，删除资源时由外键级联清理摘录、概念关系和消息引用。
- 聊天新增最多五项显式资源选择；服务端只加载同工作区资料，以不可信上下文注入，并要求使用 `[来源 N]`；助手消息与来源关系在同一事务落库，历史重载仍展示来源卡片。
- 资源创建、重复合并、更新、摘录创建/删除和资源删除均写入版本化 LearningEvent。

## 数据迁移

- `0012` 新建 `resource_terms`、`resource_highlights` 和 `message_resources`，为资源补 canonical URL、元数据、进度、标签和更新时间；旧资源 URL 与单 Concept 关系自动回填。
- 真实库迁移前完成 WAL checkpoint，并备份到 `data/backups/mentor-before-phase13-20260815-0300.db`；备份与迁移前主库 SHA256 一致。
- 真实库迁移后共 13 条迁移，三张新表与 canonical 唯一索引、状态更新时间索引均存在；`quick_check=ok`，外键检查为空。

## 截图审查

截图位于 `data/ui-captures/13-resource-knowledge-inbox/`，不进入 Git。

- `empty`：空态把新增动作保留在页头，左右工作区保持稳定尺寸。
- `detail`：队列、内容和状态三段信息层级清楚，多 Concept 与标签可扫描。
- `duplicate-merged`：重复 URL 以单通道 Toast 明确反馈，主列表仍只有一个条目。
- `highlight`：摘录、注释和来源定位形成紧凑引用块，不与阅读状态竞争。
- `reading-filter`：在读队列、45% 进度、标签和 Concept 搜索同时生效，焦点环与长标题无溢出。
- `chat-citation` / `chat-citation-reloaded`：来源卡片在发送完成与整页刷新后一致。

七个 `1440x900` 状态经人工复核，无不合理重叠、横向滚动、弹层裁切或动态跳位。

## 自动验证

- URL 单测覆盖跟踪参数/fragment 清理、类型推断和内网地址拒绝。
- SQLite 集成测试覆盖一个资源关联三个 Concept、重复合并不增主记录、阅读更新、摘录和消息来源历史重载。
- Route Handler 合同验证首次创建为 201、重复合并为 200 且返回同一对象。
- Playwright 覆盖元数据、多概念、重复 URL、详情、摘录、进度、队列、搜索、聊天显式选择和刷新后引用。
- TypeScript、ESLint、全量 Vitest、SQLite 完整性与 Next.js production build 作为提交前质量门执行。
