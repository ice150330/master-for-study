import type { TermSegment } from './term-parse';

/**
 * 术语高亮黑名单（A2 标注纠错）：用户标记"不再高亮"的术语名存 localStorage，
 * 解析后的段里命中即降级为普通文本。客户端工具，不进 DB、不写事件流。
 */

const BLACKLIST_KEY = 'mentor-term-blacklist';
const BLACKLIST_EVENT = 'mentor-term-blacklist-change';

export function subscribeTermBlacklist(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(BLACKLIST_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(BLACKLIST_EVENT, callback);
  };
}

/** 快照：黑名单 Set（服务端快照恒为空，避免 hydration 不匹配）。 */
export function readTermBlacklist(): Set<string> {
  try {
    const raw = localStorage.getItem(BLACKLIST_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function addTermToBlacklist(name: string) {
  const normalized = name.trim();
  if (!normalized) return;
  const next = new Set(readTermBlacklist());
  next.add(normalized);
  try {
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify([...next]));
  } catch {
    // 忽略写入失败（隐私模式等）
  }
  window.dispatchEvent(new Event(BLACKLIST_EVENT));
}

export function removeTermFromBlacklist(name: string) {
  const next = new Set(readTermBlacklist());
  if (!next.delete(name.trim())) return;
  try {
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify([...next]));
  } catch {
    // 忽略
  }
  window.dispatchEvent(new Event(BLACKLIST_EVENT));
}

/** 纯函数：把命中黑名单的术语段降级为普通文本（相邻文本段不合并，渲染等价）。 */
export function filterMutedSegments(segments: TermSegment[], muted: ReadonlySet<string>): TermSegment[] {
  if (muted.size === 0) return segments;
  return segments.map((segment) =>
    segment.type === 'term' && muted.has(segment.value)
      ? { type: 'text' as const, value: segment.value }
      : segment,
  );
}
