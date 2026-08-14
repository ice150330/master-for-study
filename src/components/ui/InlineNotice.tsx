import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type NoticeTone = 'error' | 'success' | 'info';

const toneStyles: Record<NoticeTone, string> = {
  error: 'border-danger/30 bg-danger/8 text-danger',
  success: 'border-accent/30 bg-accent/8 text-accent',
  info: 'border-primary/25 bg-primary/8 text-primary',
};

const toneIcons: Record<NoticeTone, ReactNode> = {
  error: <AlertCircle aria-hidden="true" />,
  success: <CheckCircle2 aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
};

export function InlineNotice({
  title,
  description,
  tone = 'info',
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  description?: string;
  tone?: NoticeTone;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm',
        toneStyles[tone],
        className,
      )}
    >
      <span className="mt-0.5 shrink-0 [&>svg]:size-4">{toneIcons[tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button className="self-center" size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
