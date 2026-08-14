import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from '../src/lib/resources/metadata';
import { inferResourceType, normalizeResourceUrl } from '../src/lib/resources/url';

describe('资源 URL 与元数据边界', () => {
  it('移除跟踪参数、片段和尾斜杠，并稳定排序业务参数', () => {
    expect(normalizeResourceUrl('HTTPS://Example.com/docs/?utm_source=x&b=2&a=1#part')).toBe(
      'https://example.com/docs?a=1&b=2',
    );
  });

  it('拒绝非 HTTP 协议并识别私网地址', () => {
    expect(() => normalizeResourceUrl('file:///etc/passwd')).toThrow('HTTP');
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('192.168.1.20')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('按站点和路径推断资源类型', () => {
    expect(inferResourceType('https://github.com/sql-js/sql.js')).toBe('GitHub');
    expect(inferResourceType('https://developer.mozilla.org/en-US/docs/Web/HTTP')).toBe('文档');
    expect(inferResourceType('https://www.youtube.com/watch?v=1')).toBe('视频');
  });
});
