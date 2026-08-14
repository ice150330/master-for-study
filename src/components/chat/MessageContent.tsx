import type { ReactNode } from 'react';
import { Term, type TermAction } from './Term';

/**
 * 流式正文解析器：把 `[[术语]]` 内联标记解析成高亮术语组件。
 * 未闭合的尾部 `[[` 会当作普通文本渲染，待下一段流补齐后再高亮。
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
  const nodes: ReactNode[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(regex)) {
    if (m.index !== undefined && m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    nodes.push(
      <Term
        key={key++}
        name={m[1]}
        definition={termDefs[m[1]]}
        onAction={onTermAction}
      />,
    );
    last = (m.index ?? 0) + m[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return <>{nodes}</>;
}
