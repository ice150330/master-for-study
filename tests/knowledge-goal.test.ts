import { describe, expect, it } from 'vitest';
import { goalKeywords, isGoalMainline } from '../src/lib/knowledge/goal';

describe('成长目标主线匹配（B3）', () => {
  it('岗位目标展开同义词域，自定义目标走 2 字滑片兜底', () => {
    const backend = goalKeywords('后端工程师');
    expect(backend).toContain('后端');
    expect(backend).toContain('数据库');
    expect(backend).toContain('事务');
    // 自定义目标：滑片命中
    const custom = goalKeywords('摄影构图');
    expect(custom).toContain('摄影');
    expect(custom).toContain('构图');
    // 空目标无关键词
    expect(goalKeywords(null)).toEqual([]);
    expect(goalKeywords('  ')).toEqual([]);
  });

  it('命中标签或描述即为主线节点', () => {
    expect(isGoalMainline('后端工程师', { label: '后端基础', description: null })).toBe(true);
    expect(isGoalMainline('后端工程师', { label: '事务', description: '保证一组数据库操作一致性的边界。' })).toBe(true);
    expect(isGoalMainline('后端工程师', { label: '主动回忆', description: '学习策略。' })).toBe(false);
    expect(isGoalMainline(null, { label: '后端基础', description: null })).toBe(false);
  });
});
