import { describe, expect, it } from 'vitest';
import { starterPrompts } from '../src/lib/chat-starters';

describe('冷启动引导问题（C2）', () => {
  it('无目标时给通用起步问题', () => {
    const prompts = starterPrompts(null);
    expect(prompts).toHaveLength(3);
    expect(prompts.every((item) => item.length > 8)).toBe(true);
    expect(starterPrompts(undefined)).toEqual(prompts);
    expect(starterPrompts('   ')).toEqual(prompts);
  });

  it('按成长目标定制：后端 / 前端 / 算法 / 转行各有专属问题', () => {
    expect(starterPrompts('后端工程师')[0]).toContain('后端');
    expect(starterPrompts('前端工程师')[0]).toContain('前端');
    expect(starterPrompts('算法·AI')[0]).toContain('算法');
    expect(starterPrompts('转行求职')[1]).toContain('面试');
    // 未识别的目标回退为围绕目标本身的通用三问
    const custom = starterPrompts('摄影构图');
    expect(custom[0]).toContain('摄影构图');
  });
});
