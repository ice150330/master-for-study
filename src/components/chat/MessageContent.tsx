import { useSyncExternalStore } from 'react';
import { filterMutedSegments, readTermBlacklist, subscribeTermBlacklist } from '@/lib/term-blacklist';
import { parseTermMarkers } from '@/lib/term-parse';
import { Term, type TermAction } from './Term';

/**
 * 流式正文渲染：用 parseTermMarkers 解析 `[[术语]]` 标记，渲染成高亮术语组件；
 * 命中「不再高亮」黑名单的术语降级为普通文本（A2 标注纠错）。
 */
export function MessageContent({
  text,
  termDefs,
  onTermAction,
  messageId,
}: {
  text: string;
  termDefs: Record<string, string>;
  onTermAction?: (action: TermAction, name: string, messageId: string) => void;
  messageId: string;
}) {
  // 黑名单为 localStorage 真相源（服务端快照恒为空集），变更后消息区自动重渲染
  const blacklist = useSyncExternalStore(
    subscribeTermBlacklist,
    readTermBlacklist,
    () => EMPTY_BLACKLIST,
  );
  const segments = filterMutedSegments(parseTermMarkers(text), blacklist);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'term' ? (
          <Term
            key={i}
            name={seg.value}
            definition={termDefs[seg.value]}
            onAction={onTermAction}
            sourceMessageId={messageId}
          />
        ) : (
          seg.value
        ),
      )}
    </>
  );
}

const EMPTY_BLACKLIST = new Set<string>();
