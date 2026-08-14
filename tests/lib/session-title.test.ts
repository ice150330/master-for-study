import { describe, expect, it } from 'vitest';
import { deriveSessionTitle } from '../../src/lib/session-title';

describe('会话标题生成', () => {
  it('清理术语标记和多余空白', () => {
    expect(deriveSessionTitle('  请解释 [[Cache-Control]]\n 的作用  ')).toBe(
      '请解释 Cache-Control 的作用',
    );
  });

  it('超长首问按边界截断并保留省略号', () => {
    const title = deriveSessionTitle('这是一个需要被截断的很长很长的首个学习问题', 12);
    expect(title).toHaveLength(12);
    expect(title.endsWith('…')).toBe(true);
  });

  it('空内容回退到默认标题', () => {
    expect(deriveSessionTitle(' \n ')).toBe('新会话');
  });
});
