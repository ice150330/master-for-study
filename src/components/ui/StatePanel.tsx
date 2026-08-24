import { AlertCircle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface StatePanelProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'empty' | 'error';
  className?: string;
}

function StatePanel({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  tone = 'empty',
  className,
}: StatePanelProps) {
  return (
    <div
      className={cn(
        'flex min-h-40 flex-col items-start justify-center border-y border-dashed border-border py-6',
        className,
      )}
    >
      <span
        className={cn(
          'mb-3 inline-flex size-9 rotate-[-1deg] items-center justify-center rounded-[2px] border border-dashed border-foreground/35 shadow-[2px_2px_0_var(--marker-yellow)] [&>svg]:size-[18px]',
          tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-surface text-muted',
        )}
      >
        {icon ?? (tone === 'error' ? <AlertCircle /> : <Inbox />)}
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4" size="sm" variant={tone === 'error' ? 'outline' : 'primary'} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState(props: Omit<StatePanelProps, 'tone'>) {
  return <StatePanel {...props} tone="empty" />;
}

export function ErrorState(props: Omit<StatePanelProps, 'tone'>) {
  return <StatePanel {...props} tone="error" />;
}
