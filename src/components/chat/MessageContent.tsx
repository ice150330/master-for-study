import { parseTermMarkers } from '@/lib/term-parse';
import { Term, type TermAction } from './Term';

/**
 * 流式正文渲染：用 parseTermMarkers 解析 `[[术语]]` 标记，渲染成高亮术语组件。
 */
export function MessageContent({
  text,
  termDefs,
  onTermAction,
}: {
  text: string;
  termDefs: Record<string, string>;
  onTermAction?: (action: TermAction, name: string) => void;
}) {
  const segments = parseTermMarkers(text);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'term' ? (
          <Term
            key={i}
            name={seg.value}
            definition={termDefs[seg.value]}
            onAction={onTermAction}
          />
        ) : (
          seg.value
        ),
      )}
    </>
  );
}
