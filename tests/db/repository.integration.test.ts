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
});
