import { TodayView } from '@/components/today/TodayView';

export default function FirstTodayFixturePage() {
  return (
    <TodayView
      initialActions={[
        {
          id: 'continue:first-chat',
          kind: 'continue',
          title: '从一个真实问题开始',
          description: '提出你当前最想弄懂的问题，Mentor 会从对话中建立概念、笔记和复习队列。',
          source: '当前工作区尚无学习记录',
          effort: '没有固定时长',
          href: '/',
          actionLabel: '开始对话',
        },
      ]}
    />
  );
}
