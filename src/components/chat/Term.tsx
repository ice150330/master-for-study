export type TermAction = 'open' | 'branch' | 'new' | 'followup';

/** Concept 触发器：可点击、可聚焦，详情交给持久化上下文轨道展示。 */
export function Term({
  name,
  onAction,
  sourceMessageId,
}: {
  name: string;
  definition?: string;
  onAction?: (action: TermAction, name: string, messageId: string) => void;
  sourceMessageId: string;
}) {
  return (
    <button
      type="button"
      aria-label={`打开概念：${name}`}
      onClick={() => onAction?.('open', name, sourceMessageId)}
      className="inline-flex min-h-6 items-center rounded-sm px-0.5 align-baseline font-medium text-accent underline decoration-dotted decoration-accent/70 underline-offset-4 transition-colors hover:bg-accent/10 hover:text-foreground"
    >
      {name}
    </button>
  );
}
