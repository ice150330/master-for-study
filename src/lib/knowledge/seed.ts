export type KnowledgeSeedNode = {
  id: string;
  label: string;
  kind: 'domain' | 'concept';
  description: string;
};

export type KnowledgeSeedEdge = {
  source: string;
  target: string;
  relation: 'part_of' | 'prerequisite';
};

/** 首次初始化写入数据库；渲染层不直接读取这份种子。 */
export const KNOWLEDGE_SEED_NODES: KnowledgeSeedNode[] = [
  { id: 'domain:engineering', label: '工程能力', kind: 'domain', description: '把基础原理、数据能力和系统设计串成可验证的工程路径。' },
  { id: 'domain:backend', label: '后端基础', kind: 'domain', description: '网络、数据存储与服务端运行机制。' },
  { id: 'domain:data-ai', label: '数据与 AI', kind: 'domain', description: '数据处理、建模和智能系统相关能力。' },
  { id: 'domain:learning', label: '学习方法', kind: 'domain', description: '主动回忆、实践与证据驱动的学习策略。' },
  { id: 'seed:http', label: 'HTTP', kind: 'concept', description: 'Web 请求、响应与缓存语义的基础协议。' },
  { id: 'seed:dns', label: 'DNS', kind: 'concept', description: '将域名解析为网络地址的分布式系统。' },
  { id: 'seed:sql', label: 'SQL', kind: 'concept', description: '关系数据查询与修改语言。' },
  { id: 'seed:index', label: '索引', kind: 'concept', description: '以额外存储换取查询定位效率的数据结构。' },
  { id: 'seed:transaction', label: '事务', kind: 'concept', description: '保证一组数据库操作一致性的边界。' },
  { id: 'seed:python', label: 'Python', kind: 'concept', description: '常用于数据分析与 AI 实践的编程语言。' },
  { id: 'seed:machine-learning', label: '机器学习', kind: 'concept', description: '从数据中学习模式并用于预测或决策。' },
  { id: 'seed:active-recall', label: '主动回忆', kind: 'concept', description: '先尝试从记忆中提取，再查看答案的学习方式。' },
];

export const KNOWLEDGE_SEED_EDGES: KnowledgeSeedEdge[] = [
  { source: 'domain:backend', target: 'domain:engineering', relation: 'part_of' },
  { source: 'domain:data-ai', target: 'domain:engineering', relation: 'part_of' },
  { source: 'domain:learning', target: 'domain:engineering', relation: 'part_of' },
  { source: 'seed:http', target: 'domain:backend', relation: 'part_of' },
  { source: 'seed:dns', target: 'domain:backend', relation: 'part_of' },
  { source: 'seed:sql', target: 'domain:backend', relation: 'part_of' },
  { source: 'seed:index', target: 'domain:backend', relation: 'part_of' },
  { source: 'seed:transaction', target: 'domain:backend', relation: 'part_of' },
  { source: 'seed:python', target: 'domain:data-ai', relation: 'part_of' },
  { source: 'seed:machine-learning', target: 'domain:data-ai', relation: 'part_of' },
  { source: 'seed:active-recall', target: 'domain:learning', relation: 'part_of' },
  { source: 'seed:sql', target: 'seed:index', relation: 'prerequisite' },
  { source: 'seed:sql', target: 'seed:transaction', relation: 'prerequisite' },
  { source: 'seed:python', target: 'seed:machine-learning', relation: 'prerequisite' },
];
