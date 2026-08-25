import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * 页头条统计小徽标：与卡片头 D{depth} 徽标同款的手绘小签。
 * tone 只改配色点缀，文字保持可读的墨色。
 */
export function MetaChip({
  icon,
  tone = 'default',
  className,
  children,
}: {
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'danger';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rotate-[-1deg] items-center gap-1 rounded-[2px] border border-dashed px-1.5 py-0.5 text-[10px] font-semibold [&>svg]:size-3',
        tone === 'accent' && 'border-accent/55 bg-accent/12 text-foreground',
        tone === 'danger' && 'border-danger/45 bg-danger/10 text-danger',
        tone === 'default' && 'border-border bg-highlight/20 text-muted',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
