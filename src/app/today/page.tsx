import { ArrowRight, BookOpenText, MessageCircle, SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/shell/PageShell';

const actions = [
  {
    href: '/',
    title: '继续上次对话',
    description: '回到当前学习主题，保留已有会话上下文。',
    icon: MessageCircle,
    tone: 'bg-primary/10 text-primary',
  },
  {
    href: '/review',
    title: '处理到期复习',
    description: '先完成需要主动回忆的术语卡片。',
    icon: BookOpenText,
    tone: 'bg-warning/10 text-warning',
  },
  {
    href: '/practice',
    title: '完成一项 SQL 实践',
    description: '用一次可运行的查询巩固今天的理解。',
    icon: SquareTerminal,
    tone: 'bg-accent/10 text-accent',
  },
] as const;

export default function TodayPage() {
  return (
    <PageShell title="今日学习" description="从一个明确动作开始，不用重新寻找上下文" width="lg">
      <div className="border-y border-border">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-4 border-b border-border px-1 py-5 last:border-b-0 hover:bg-surface/60"
            >
              <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${action.tone}`}>
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{action.title}</span>
                <span className="mt-1 block text-sm text-muted">{action.description}</span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-[18px] shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
