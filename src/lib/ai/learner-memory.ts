/**
 * 学习者画像记忆注入（优化方向 A1）。
 * 蓝图承诺"有记忆的老师"：把近期主题与薄弱概念摘要注入聊天系统提示词，
 * 让老师跨会话延续教学，而不是每次失忆重来。
 */

export type LearnerProfileSnapshot = {
  /** 最近学习主题（会话标题，已滤默认标题） */
  recentTopics: string[];
  /** 已确认入队且学过的薄弱概念，按难度降序 */
  weakConcepts: Array<{
    name: string;
    state: 'new' | 'learning' | 'reviewing' | 'relearning';
    difficulty: number | null;
  }>;
};

const STATE_LABELS: Record<LearnerProfileSnapshot['weakConcepts'][number]['state'], string> = {
  new: '新学',
  learning: '学习中',
  reviewing: '复习中',
  relearning: '再学习',
};

/**
 * 生成注入系统提示词的记忆段；画像为空时返回空串（不占提示词）。
 * 指令要求自然运用，禁止逐条复述或炫耀记忆。
 */
export function learnerMemoryPrompt(snapshot: LearnerProfileSnapshot): string {
  const topics = snapshot.recentTopics.slice(0, 5);
  const weak = snapshot.weakConcepts
    .filter((concept) => concept.state !== 'new')
    .slice(0, 8)
    .map((concept) => `${concept.name}（${STATE_LABELS[concept.state]}${formatDifficulty(concept.difficulty)}）`);

  if (topics.length === 0 && weak.length === 0) return '';

  const lines = ['以下是这位学习者的长期记忆摘要，供你个性化教学使用：'];
  if (topics.length > 0) lines.push(`- 最近在学的话题：${topics.join('、')}`);
  if (weak.length > 0) {
    lines.push(`- 掌握较薄弱、值得优先衔接巩固的概念：${weak.join('、')}`);
  }
  lines.push(
    '使用要求：自然地延续和引用这些背景（例如讲解新概念时与薄弱概念建立联系），',
    '不要逐条复述这份清单，也不要主动宣称"我记得你……"，除非与当前问题相关。',
  );
  return lines.join('\n');
}

function formatDifficulty(difficulty: number | null): string {
  return difficulty === null || !Number.isFinite(difficulty) ? '' : `，难度 ${difficulty.toFixed(1)}`;
}
