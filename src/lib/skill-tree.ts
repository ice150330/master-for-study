import type { TreeInput } from './tree-layout';

/**
 * 个人成长地图的内置能力树（示例：后端工程师）。
 * 每个叶子节点通过 `term` 关联术语，用术语掌握度状态上色（热力）。
 */

export type SkillData = { term?: string; state?: string };

export const BACKEND_SKILL_TREE: TreeInput<SkillData> = {
  id: 'backend',
  label: '后端工程师',
  children: [
    {
      id: 'net',
      label: '计算机网络',
      children: [
        { id: 'http', label: 'HTTP', data: { term: 'HTTP' }, children: [] },
        { id: 'tcp', label: 'TCP/IP', data: { term: 'TCP' }, children: [] },
        { id: 'dns', label: 'DNS', data: { term: 'DNS' }, children: [] },
        { id: 'tls', label: 'HTTPS', data: { term: 'HTTPS' }, children: [] },
      ],
    },
    {
      id: 'db',
      label: '数据库',
      children: [
        { id: 'sql', label: 'SQL', data: { term: 'SQL' }, children: [] },
        { id: 'index', label: '索引', data: { term: '索引' }, children: [] },
        { id: 'txn', label: '事务', data: { term: '事务' }, children: [] },
      ],
    },
    {
      id: 'os',
      label: '操作系统',
      children: [
        { id: 'process', label: '进程', data: { term: '进程' }, children: [] },
        { id: 'memory', label: '内存', data: { term: '内存' }, children: [] },
      ],
    },
    {
      id: 'sysdesign',
      label: '系统设计',
      children: [
        { id: 'cache', label: '缓存', data: { term: '缓存' }, children: [] },
        { id: 'lb', label: '负载均衡', data: { term: '负载均衡' }, children: [] },
      ],
    },
  ],
};

/**
 * 掌握度状态 → 节点配色（热力）。
 * 热力四态用固定高饱和色（其上文字深色，与主题无关，两主题均可读）；
 * 「未接触」与品牌紫走 CSS 变量令牌（随浅/深主题切换，见 globals.css）。
 * 返回值是 CSS 颜色字符串，由 TreeGraph 经 style 对象注入 SVG。
 */
export function stateToStyle(state?: string): { fill: string; text: string } {
  switch (state) {
    case 'reviewing':
      return { fill: '#00cec9', text: '#1a1a2e' }; // 已掌握
    case 'learning':
      return { fill: '#ffeaa7', text: '#1a1a2e' }; // 学习中
    case 'relearning':
      return { fill: '#fd79a8', text: '#1a1a2e' }; // 重学中
    case 'new':
      return { fill: 'var(--primary)', text: 'var(--primary-foreground)' }; // 新发现
    default:
      return { fill: 'var(--state-untouched)', text: 'var(--state-untouched-fg)' }; // 未接触
  }
}
