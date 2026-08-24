import { TodayView } from '@/components/today/TodayView';
import type { TodayLearningAction } from '@/lib/db';

const actions: TodayLearningAction[] = [
  {
    id: 'continue:http-cache',
    kind: 'continue',
    title: '继续：HTTP 缓存策略',
    description: '上次停在 Cache-Control 与协商缓存的区别，已有 8 条消息可继续。',
    source: '来自最近一次 message_sent 事件',
    effort: '约 5–15 分钟',
    href: '/?session=11111111-1111-4111-8111-111111111111',
    actionLabel: '继续学习',
  },
  {
    id: 'review:due',
    kind: 'review',
    title: '4 个概念已到期',
    description: '从「Cache-Control」开始主动回忆，完成后自动排定下次复习。',
    source: '来自 term_masteries 到期时间',
    effort: '约 5–10 分钟',
    href: '/review',
    actionLabel: '开始复习',
  },
  {
    id: 'interview:cache-control',
    kind: 'interview',
    title: '测验：HTTP Cache-Control',
    description: '用一次结构化问答检查是否真正理解这个概念。',
    source: '来自掌握状态 learning 与难度记录',
    effort: '约 10–20 分钟',
    href: '/interview?concept=cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    actionLabel: '开始测验',
  },
  {
    id: 'resource:mdn-cache',
    kind: 'resource',
    title: '继续资源：MDN HTTP 缓存',
    description: '文档 · 当前状态「在读」',
    source: '来自资源库 在读 队列',
    effort: '按内容自行安排',
    href: '/resources?resource=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    actionLabel: '打开资源',
  },
  {
    id: 'note:cache-summary',
    kind: 'note',
    title: '回看笔记：缓存策略小结',
    description: '从最近沉淀的知识文档恢复上下文。',
    source: '来自最近生成的学习笔记',
    effort: '约 5–10 分钟',
    href: '/notes?note=dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    actionLabel: '查看笔记',
  },
];

export default function TodayFixturePage() {
  return <TodayView initialActions={actions} />;
}
