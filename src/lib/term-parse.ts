/**
 * 术语标记解析：把正文中的 `[[术语]]` 内联标记解析成文本 / 术语段。
 * 未闭合的尾部 `[[` 视为普通文本，待后续流式补齐后再解析。
 */

export type TermSegment =
  | { type: 'text'; value: string }
  | { type: 'term'; value: string };

export function parseTermMarkers(text: string): TermSegment[] {
  const segments: TermSegment[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let last = 0;

  for (const m of text.matchAll(regex)) {
    const index = m.index ?? 0;
    if (index > last) {
      segments.push({ type: 'text', value: text.slice(last, index) });
    }
    segments.push({ type: 'term', value: m[1] });
    last = index + m[0].length;
  }

  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) });
  }

  return segments;
}
