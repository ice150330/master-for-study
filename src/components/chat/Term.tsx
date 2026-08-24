import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';

export type TermAction = 'open' | 'branch' | 'new' | 'followup';

/** Concept 触发器：悬停先读短定义，点击再打开带来源的完整轨道。 */
export function Term({
  name,
  definition,
  onAction,
  sourceMessageId,
}: {
  name: string;
  definition?: string;
  onAction?: (action: TermAction, name: string, messageId: string) => void;
  sourceMessageId: string;
}) {
  return (
    <Tooltip delayDuration={220}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`打开概念：${name}`}
          onClick={() => onAction?.('open', name, sourceMessageId)}
          className="marker-highlight inline-flex min-h-6 items-center rounded-[2px] px-0.5 align-baseline font-bold text-foreground underline decoration-wavy decoration-accent decoration-2 underline-offset-4 transition-[transform,background-color,color] duration-150 hover:-rotate-1 hover:bg-highlight/30 hover:text-foreground"
        >
          {name}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={9}
        className="paper-popover max-w-72 border-2 border-dashed p-3 text-card-foreground"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
          <Sparkles aria-hidden="true" className="size-3" />陌生知识点
        </span>
        <strong className="mt-1 block text-xs text-foreground">{name}</strong>
        <span className="mt-1 block text-[11px] leading-5 text-muted">
          {definition || '定义正在整理，点击查看完整知识对象。'}
        </span>
        <span className="doodle-link mt-1.5 block text-[10px] text-foreground">点击查看来源与关联内容</span>
      </TooltipContent>
    </Tooltip>
  );
}
