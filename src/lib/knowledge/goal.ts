/**
 * 成长目标 → 知识图主线匹配（优化方向 B3）。
 * 按目标关键词命中节点标签/描述，命中节点在白板标为「目标主线」。
 */

/** 常见岗位 / 身份目标的知识域同义词（命中任一即主线）。 */
const GOAL_SYNONYMS: Array<{ match: RegExp; keywords: string[] }> = [
  { match: /后端|服务端|backend/i, keywords: ['后端', '服务端', '数据库', 'SQL', '接口', '缓存', '并发', '事务', '索引', 'HTTP', '网络'] },
  { match: /前端|front|Web 开发/i, keywords: ['前端', '浏览器', '渲染', 'CSS', 'DOM', 'React', 'HTTP', '网络'] },
  { match: /算法|AI|人工智能|机器学习|深度学习/i, keywords: ['算法', '复杂度', '数据结构', '机器学习', '深度学习', '神经网络', '梯度', '数学'] },
  { match: /数据|大数据/i, keywords: ['数据', 'SQL', '数据库', '统计', '仓库'] },
  { match: /测试|QA/i, keywords: ['测试', '质量', '断言', '覆盖'] },
  { match: /运维|SRE|云计算/i, keywords: ['运维', '部署', '容器', 'Linux', '网络', '监控'] },
  { match: /安全|渗透/i, keywords: ['安全', '加密', '认证', '网络'] },
];

/** 从目标文本提取关键词：同义词域 + 目标本身的 2 字滑片（兜底自定义目标）。 */
export function goalKeywords(goal: string | null | undefined): string[] {
  const normalized = (goal ?? '').trim();
  if (!normalized) return [];
  const keywords = new Set<string>();
  for (const rule of GOAL_SYNONYMS) {
    if (rule.match.test(normalized)) rule.keywords.forEach((keyword) => keywords.add(keyword));
  }
  for (let index = 0; index + 2 <= normalized.length; index += 1) {
    keywords.add(normalized.slice(index, index + 2));
  }
  return [...keywords].filter((keyword) => !/[\s·]/.test(keyword));
}

/** 节点是否落在目标主线上：标签或描述命中任一关键词。 */
export function isGoalMainline(
  goal: string | null | undefined,
  node: { label: string; description?: string | null },
): boolean {
  const keywords = goalKeywords(goal);
  if (keywords.length === 0) return false;
  const haystack = `${node.label} ${node.description ?? ''}`.toLocaleLowerCase('zh-CN');
  return keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase('zh-CN')));
}
