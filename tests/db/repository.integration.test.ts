import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDir: string;
let dbPath: string;
let repository: typeof import('../../src/lib/db');

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-db-'));
  dbPath = path.join(tempDir, 'integration.db');
  process.env.MENTOR_DB_PATH = dbPath;
  repository = await import('../../src/lib/db');
  repository.resetDbForTests();
});

afterAll(() => {
  repository.resetDbForTests();
  delete process.env.MENTOR_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('SQLite 仓库事务与幂等性', () => {
  it('活跃会话按最近活动倒序返回', async () => {
    const older = repository.createSession({
      title: '较早会话',
      idempotencyKey: 'session:test:older',
    });
    await new Promise((resolve) => setTimeout(resolve, 3));
    const newer = repository.createSession({
      title: '较新会话',
      idempotencyKey: 'session:test:newer',
    });
    expect(repository.listSessions()[0].id).toBe(newer.id);

    await new Promise((resolve) => setTimeout(resolve, 3));
    repository.saveMessage({
      sessionId: older.id,
      role: 'user',
      content: '继续较早会话',
      idempotencyKey: 'message:test:resume-older',
    });
    expect(repository.listSessions()[0].id).toBe(older.id);
  });

  it('相同幂等键只创建一个会话和一条事件', () => {
    const first = repository.createSession({
      title: '事务测试会话',
      idempotencyKey: 'session:test:create',
    });
    const second = repository.createSession({
      title: '重复请求不应覆盖',
      idempotencyKey: 'session:test:create',
    });

    expect(second.id).toBe(first.id);
    expect(repository.listSessions().filter((session) => session.id === first.id)).toHaveLength(1);
    const event = repository.findEventByIdempotencyKey('session:test:create');
    expect(event).toMatchObject({
      action: 'session_created',
      objectType: 'session',
      objectId: first.id,
      schemaVersion: 1,
    });
    expect(event?.workspaceId).toBeTruthy();
  });

  it('消息、资源和复习的重复请求不重复落库', () => {
    const session = repository.createSession({
      title: '幂等写入',
      idempotencyKey: 'session:test:writes',
    });
    const firstMessage = repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '第一次消息',
      idempotencyKey: 'message:test:one',
    });
    const secondMessage = repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '重复消息',
      idempotencyKey: 'message:test:one',
    });
    expect(secondMessage.id).toBe(firstMessage.id);
    expect(repository.listMessages(session.id)).toHaveLength(1);

    const firstResource = repository.createResource({
      title: 'SQLite 文档',
      type: '文档',
      url: 'https://sqlite.org/docs.html',
      idempotencyKey: 'resource:test:create',
    });
    const secondResource = repository.createResource({
      title: '重复资源',
      type: '博客',
      url: 'https://example.com/duplicate',
      idempotencyKey: 'resource:test:create',
    });
    expect(secondResource.id).toBe(firstResource.id);
    expect(repository.listResources().filter((resource) => resource.id === firstResource.id)).toHaveLength(1);

    const term = repository.upsertTerm({
      name: '事务',
      definition: '一组不可分割的数据库操作。',
      idempotencyKey: 'term:test:create',
    });
    const firstReview = repository.reviewTerm({
      termId: term.id,
      grade: 'good',
      idempotencyKey: 'review:test:one',
    });
    const secondReview = repository.reviewTerm({
      termId: term.id,
      grade: 'again',
      idempotencyKey: 'review:test:one',
    });
    expect(secondReview).toEqual(firstReview);
    expect(repository.findEventByIdempotencyKey('review:test:one')?.context).toEqual({ grade: 'good' });
  });

  it('事件写入失败时回滚同事务内的资源状态', () => {
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TRIGGER force_learning_event_failure
      BEFORE INSERT ON learning_events
      BEGIN
        SELECT RAISE(ABORT, 'forced event failure');
      END;
    `);

    expect(() =>
      repository.createResource({
        title: '不应残留的资源',
        type: '教程',
        url: 'https://example.com/rollback',
        idempotencyKey: 'resource:test:rollback',
      }),
    ).toThrow();

    raw.exec('DROP TRIGGER force_learning_event_failure;');
    raw.close();
    expect(repository.listResources().some((resource) => resource.title === '不应残留的资源')).toBe(false);
    expect(repository.findEventByIdempotencyKey('resource:test:rollback')).toBeUndefined();
  });

  it('首问自动命名，历史术语可恢复定义和消息来源', () => {
    const session = repository.createSession({
      idempotencyKey: 'session:test:history',
    });
    repository.upsertTerm({
      name: 'Cache-Control',
      definition: '控制 HTTP 缓存行为的响应头。',
      idempotencyKey: 'term:test:cache-control',
    });
    const userMessage = repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '请解释 [[Cache-Control]] 的作用和常见指令',
      idempotencyKey: 'message:test:history:user',
    });

    expect(repository.getSession(session.id)?.title).toBe('请解释 Cache-Control 的作用和常见指令');
    expect(repository.listHistoricalTerms(repository.listMessages(session.id))).toEqual([
      {
        name: 'Cache-Control',
        definition: '控制 HTTP 缓存行为的响应头。',
        sources: [{ messageId: userMessage.id, sessionId: session.id }],
      },
    ]);
  });

  it('会话支持置顶、归档、恢复和事务删除', () => {
    const session = repository.createSession({
      title: '待管理会话',
      idempotencyKey: 'session:test:manage',
    });
    repository.updateSession(session.id, {
      action: 'pin',
      pinned: true,
      idempotencyKey: 'session:test:pin',
    });
    expect(repository.getSession(session.id)?.pinnedAt).toBeInstanceOf(Date);

    repository.updateSession(session.id, {
      action: 'archive',
      archived: true,
      idempotencyKey: 'session:test:archive',
    });
    expect(repository.listSessions().some((item) => item.id === session.id)).toBe(false);
    expect(repository.listSessions({ archived: true }).some((item) => item.id === session.id)).toBe(true);

    repository.updateSession(session.id, {
      action: 'archive',
      archived: false,
      idempotencyKey: 'session:test:restore',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '删除前消息',
      idempotencyKey: 'message:test:before-delete',
    });
    expect(repository.deleteSession(session.id, 'session:test:delete')).toBe(true);
    expect(repository.getSession(session.id)).toBeUndefined();
    expect(repository.listMessages(session.id)).toEqual([]);
    expect(repository.findEventByIdempotencyKey('session:test:delete')).toMatchObject({
      action: 'session_deleted',
      objectId: session.id,
    });
  });

  it('语义分支只继承锚点之前的祖先消息', () => {
    const root = repository.createSession({
      title: 'HTTP 根会话',
      idempotencyKey: 'session:test:branch-root',
    });
    const rootQuestion = repository.saveMessage({
      sessionId: root.id,
      role: 'user',
      content: '缓存是什么？',
      idempotencyKey: 'message:test:branch-root-question',
    });
    const rootAnswer = repository.saveMessage({
      sessionId: root.id,
      role: 'assistant',
      content: '缓存复用已有响应。',
      idempotencyKey: 'message:test:branch-root-answer',
    });
    repository.saveMessage({
      sessionId: root.id,
      role: 'user',
      content: '这条消息位于分叉点之后，不应继承。',
      idempotencyKey: 'message:test:branch-after-anchor',
    });

    const branch = repository.createSession({
      parentId: root.id,
      forkedFromMessageId: rootAnswer.id,
      title: '缓存分支',
      idempotencyKey: 'session:test:semantic-branch',
    });
    const branchQuestion = repository.saveMessage({
      sessionId: branch.id,
      role: 'user',
      content: '那浏览器如何复用？',
      idempotencyKey: 'message:test:branch-question',
    });

    expect(branch.rootSessionId).toBe(root.id);
    expect(branch.forkedFromMessageId).toBe(rootAnswer.id);
    expect(repository.listMessages(root.id)).toHaveLength(3);
    expect(repository.listSessionContextMessages(branch.id).map((message) => message.id)).toEqual([
      rootQuestion.id,
      rootAnswer.id,
      branchQuestion.id,
    ]);
  });

  it('拒绝使用其他会话的消息作为分支锚点', () => {
    const parent = repository.createSession({
      title: '合法父会话',
      idempotencyKey: 'session:test:anchor-parent',
    });
    const other = repository.createSession({
      title: '其他会话',
      idempotencyKey: 'session:test:anchor-other',
    });
    const otherMessage = repository.saveMessage({
      sessionId: other.id,
      role: 'assistant',
      content: '不属于父会话',
      idempotencyKey: 'message:test:anchor-other',
    });

    expect(() =>
      repository.createSession({
        parentId: parent.id,
        forkedFromMessageId: otherMessage.id,
        idempotencyKey: 'session:test:invalid-anchor',
      }),
    ).toThrow('分支锚点不属于父会话');
  });

  it('Concept 合并别名并统一聚合消息、笔记和资源来源', () => {
    const session = repository.createSession({
      title: 'Concept 来源测试',
      idempotencyKey: 'session:test:concept-source',
    });
    const message = repository.saveMessage({
      sessionId: session.id,
      role: 'assistant',
      content: 'Cache-Control 控制缓存复用。',
      idempotencyKey: 'message:test:concept-source',
    });
    const concept = repository.upsertTerm({
      name: 'Cache-Control',
      canonicalName: 'HTTP Cache-Control',
      aliases: ['缓存控制'],
      definition: 'HTTP 缓存控制响应头。',
      example: 'max-age=3600',
      confidence: 0.8,
      idempotencyKey: 'term:test:concept-v1',
    });
    const merged = repository.upsertTerm({
      name: '缓存控制',
      canonicalName: 'HTTP Cache-Control',
      aliases: ['Cache-Control'],
      definition: '用于声明缓存复用条件和有效期的 HTTP 响应头。',
      example: 'Cache-Control: no-store',
      confidence: 0.96,
      idempotencyKey: 'term:test:concept-v2',
    });
    expect(merged.id).toBe(concept.id);
    expect(merged.definition).toContain('复用条件');
    expect(merged.aliases).toContain('缓存控制');

    repository.recordConceptMention({
      termId: concept.id,
      sourceType: 'message',
      sourceId: message.id,
      sessionId: session.id,
      excerpt: message.content,
      idempotencyKey: 'mention:test:concept-message',
    });
    const note = repository.createNote({
      sessionId: session.id,
      title: '缓存笔记',
      content: {
        coreConcepts: [{ name: 'HTTP Cache-Control', explanation: '缓存策略入口' }],
        terms: [],
      },
      markdown: '# 缓存笔记',
      idempotencyKey: 'note:test:concept-source',
    });
    const resource = repository.createResource({
      title: 'MDN 缓存文档',
      type: '文档',
      url: 'https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control',
      termId: concept.id,
      idempotencyKey: 'resource:test:concept-source',
    });

    const detail = repository.getConceptDetail({ name: '缓存控制' });
    expect(detail?.concept.id).toBe(concept.id);
    expect(detail?.mentions.map((mention) => mention.sourceType).sort()).toEqual([
      'message',
      'note',
      'resource',
    ]);
    expect(detail?.relatedNotes).toContainEqual({ id: note.id, title: note.title, sessionId: session.id });
    expect(detail?.relatedResources[0]).toMatchObject({ id: resource.id, title: resource.title });
  });

  it('今日行动投影只引用真实会话、到期记录和未完成资源', () => {
    const session = repository.createSession({
      title: '今日投影会话',
      idempotencyKey: 'session:test:today-projection',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '继续学习事务隔离级别',
      idempotencyKey: 'message:test:today-projection',
    });
    const resource = repository.createResource({
      title: '今日未读资源',
      type: '教程',
      url: 'https://example.com/today-resource',
      idempotencyKey: 'resource:test:today-projection',
    });

    const actions = repository.getTodayLearningActions();
    expect(actions.find((action) => action.kind === 'continue')).toMatchObject({
      href: `/?session=${session.id}`,
    });
    expect(actions.find((action) => action.kind === 'review')?.source).toContain('到期时间');
    expect(actions.find((action) => action.id === `resource:${resource.id}`)).toMatchObject({
      href: `/resources?resource=${resource.id}`,
    });
    expect(actions.every((action) => action.effort.length > 0 && action.source.length > 0)).toBe(true);
  });
});
