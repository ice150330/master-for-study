import { describe, expect, it } from 'vitest';
import { parseTermMarkers } from '../src/lib/term-parse';

describe('parseTermMarkers 术语标记解析', () => {
  it('无术语的纯文本', () => {
    expect(parseTermMarkers('你好，世界')).toEqual([
      { type: 'text', value: '你好，世界' },
    ]);
  });

  it('单个术语', () => {
    expect(parseTermMarkers('DNS 是 [[域名系统]]')).toEqual([
      { type: 'text', value: 'DNS 是 ' },
      { type: 'term', value: '域名系统' },
    ]);
  });

  it('多个术语', () => {
    expect(parseTermMarkers('[[HTTP]] 与 [[缓存]]')).toEqual([
      { type: 'term', value: 'HTTP' },
      { type: 'text', value: ' 与 ' },
      { type: 'term', value: '缓存' },
    ]);
  });

  it('未闭合的 [[ 视为普通文本（流式中间态）', () => {
    expect(parseTermMarkers('前面 [[未闭合')).toEqual([
      { type: 'text', value: '前面 [[未闭合' },
    ]);
  });

  it('空字符串返回空段', () => {
    expect(parseTermMarkers('')).toEqual([]);
  });
});
