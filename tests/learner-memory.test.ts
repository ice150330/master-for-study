import { describe, expect, it } from 'vitest';
import { learnerMemoryPrompt } from '../src/lib/ai/learner-memory';

describe('学习者画像记忆注入（A1）', () => {
  it('空画像返回空串，不占系统提示词', () => {
    expect(learnerMemoryPrompt({ recentTopics: [], weakConcepts: [] })).toBe('');
  });

  it('有数据时生成包含话题与薄弱概念的记忆段', () => {
    const prompt = learnerMemoryPrompt({
      recentTopics: ['学 HTTP 缓存', '数据库事务'],
      weakConcepts: [
        { name: 'MVCC', state: 'relearning', difficulty: 8.2 },
        { name: 'WAL', state: 'learning', difficulty: null },
      ],
    });
    expect(prompt).toContain('学 HTTP 缓存');
    expect(prompt).toContain('MVCC（再学习，难度 8.2）');
    expect(prompt).toContain('WAL（学习中）');
    // 使用要求：自然运用，不复述、不炫耀
    expect(prompt).toContain('不要逐条复述');
  });

  it('过滤 new 状态概念并截断到 8 个', () => {
    const weakConcepts = Array.from({ length: 12 }, (_, index) => ({
      name: `概念${index}`,
      state: (index === 0 ? 'new' : 'reviewing') as 'new' | 'reviewing',
      difficulty: 5,
    }));
    const prompt = learnerMemoryPrompt({ recentTopics: [], weakConcepts });
    expect(prompt).not.toContain('概念0');
    // 11 个非 new，截断到 8：概念1..概念8 在场，概念11 不在
    expect(prompt).toContain('概念8');
    expect(prompt).not.toContain('概念11');
  });
});
