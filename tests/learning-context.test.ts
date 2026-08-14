import { describe, expect, it } from 'vitest';
import {
  attemptHref,
  contextFocusRef,
  parseLearningContext,
  sourceHref,
  withLearningContext,
  withoutLearningContext,
} from '../src/lib/learning-context';

describe('跨模块学习上下文', () => {
  it('解析工作区、概念、消息来源和尝试', () => {
    const params = new URLSearchParams({
      workspace: 'workspace-1',
      concept: 'term-1',
      source: 'message:session-1:message-1',
      attempt: 'practice:attempt-1',
    });
    expect(parseLearningContext(params)).toEqual({
      workspaceId: 'workspace-1',
      conceptId: 'term-1',
      source: { type: 'message', sessionId: 'session-1', messageId: 'message-1' },
      attempt: { type: 'practice', id: 'attempt-1' },
    });
  });

  it('拒绝非法或结构不完整的引用', () => {
    const params = new URLSearchParams({
      workspace: '../outside',
      concept: 'term:bad',
      source: 'message:only-session',
      attempt: 'unknown:attempt-1',
    });
    expect(parseLearningContext(params)).toEqual({
      workspaceId: null,
      conceptId: null,
      source: null,
      attempt: null,
    });
  });

  it('保留流式消息使用的复合来源 ID', () => {
    const params = new URLSearchParams({
      concept: 'term-1',
      source: 'message:session-1:chat:request-1:assistant',
    });
    expect(parseLearningContext(params).source).toEqual({
      type: 'message',
      sessionId: 'session-1',
      messageId: 'chat:request-1:assistant',
    });
  });

  it('在保留模块选择参数的同时追加上下文', () => {
    const href = withLearningContext('/practice?challenge=sql-filter-sort#editor', {
      workspaceId: 'workspace-1',
      conceptId: 'term-1',
      source: { type: 'note', id: 'note-1' },
      attempt: null,
    });
    expect(href).toBe('/practice?challenge=sql-filter-sort&workspace=workspace-1&concept=term-1&source=note%3Anote-1#editor');
    expect(withoutLearningContext(href)).toBe('/practice?challenge=sql-filter-sort#editor');
  });

  it('来源与尝试链接保持同一概念并生成聚焦引用', () => {
    const context = {
      workspaceId: 'workspace-1',
      conceptId: 'term-1',
      source: { type: 'resource', id: 'resource-1' } as const,
      attempt: { type: 'review', id: 'review-1' } as const,
    };
    expect(sourceHref(context.source, context)).toContain('/resources?resource=resource-1');
    expect(sourceHref(context.source, context)).not.toContain('attempt=');
    expect(attemptHref(context.attempt, context)).toContain('attempt=review%3Areview-1');
    expect(contextFocusRef(context)).toBe('review:review-1');
  });
});
