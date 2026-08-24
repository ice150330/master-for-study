import { describe, expect, it } from 'vitest';
import { filterMutedSegments } from '../src/lib/term-blacklist';
import { parseTermMarkers } from '../src/lib/term-parse';

describe('术语高亮黑名单（A2 标注纠错）', () => {
  it('命中黑名单的术语段降级为普通文本，未命中的保持高亮', () => {
    const segments = parseTermMarkers('先看 [[MVCC]]，再看 [[缓存]] 与 [[MVCC]]');
    const muted = filterMutedSegments(segments, new Set(['MVCC']));
    expect(muted.filter((segment) => segment.type === 'term')).toEqual([
      { type: 'term', value: '缓存' },
    ]);
    // 被降级的 MVCC 以普通文本形式保留（内容不丢失）
    expect(muted.filter((segment) => segment.type === 'text' && segment.value === 'MVCC')).toHaveLength(2);
  });

  it('空黑名单原样返回', () => {
    const segments = parseTermMarkers('[[MVCC]] 与 [[缓存]]');
    expect(filterMutedSegments(segments, new Set())).toBe(segments);
  });
});
