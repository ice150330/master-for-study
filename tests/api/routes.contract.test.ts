import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type PostHandler = (request: Request) => Promise<Response>;

let tempDir: string;
let repository: typeof import('../../src/lib/db');
let resourcesPost: PostHandler;
let reviewPost: PostHandler;
let eventsPost: PostHandler;
let practicePost: PostHandler;
let sessionsPost: PostHandler;
let notesPost: PostHandler;
let interviewPost: PostHandler;
let chatPost: PostHandler;
let termsPost: PostHandler;
let knowledgePatch: PostHandler;
let handlers: Record<string, PostHandler>;

function jsonRequest(pathname: string, body: unknown) {
  return new Request(`http://localhost${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-api-'));
  process.env.MENTOR_DB_PATH = path.join(tempDir, 'contracts.db');
  repository = await import('../../src/lib/db');
  repository.resetDbForTests();
  resourcesPost = (await import('../../src/app/api/resources/route')).POST;
  reviewPost = (await import('../../src/app/api/review/route')).POST;
  eventsPost = (await import('../../src/app/api/events/route')).POST;
  practicePost = (await import('../../src/app/api/practice/route')).POST;
  sessionsPost = (await import('../../src/app/api/sessions/route')).POST;
  notesPost = (await import('../../src/app/api/notes/route')).POST;
  interviewPost = (await import('../../src/app/api/interview/route')).POST;
  chatPost = (await import('../../src/app/api/chat/route')).POST;
  termsPost = (await import('../../src/app/api/terms/route')).POST;
  knowledgePatch = (await import('../../src/app/api/knowledge-graph/route')).PATCH;
  handlers = {
    resources: resourcesPost,
    review: reviewPost,
    events: eventsPost,
    practice: practicePost,
    sessions: sessionsPost,
    notes: notesPost,
    interview: interviewPost,
    chat: chatPost,
    terms: termsPost,
    knowledge: knowledgePatch,
  };
});

afterAll(() => {
  repository.resetDbForTests();
  delete process.env.MENTOR_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Route Handler zod 合同', () => {
  it.each([
    ['resources', '/api/resources', { title: 'x', type: '播客', url: 'not-url', idempotencyKey: 'invalid:resource' }],
    ['review', '/api/review', { termId: crypto.randomUUID(), grade: 'perfect', idempotencyKey: 'invalid:review' }],
    ['events', '/api/events', { action: 'arbitrary_event', idempotencyKey: 'invalid:event' }],
    ['practice', '/api/practice', { challengeId: '../bad', status: 'done', idempotencyKey: 'invalid:practice' }],
    ['sessions', '/api/sessions', { parentId: 'not-a-uuid', idempotencyKey: 'invalid:session' }],
    ['notes', '/api/notes', { sessionId: 'not-a-uuid', idempotencyKey: 'invalid:note' }],
    ['interview', '/api/interview', { action: 'score', idempotencyKey: 'invalid:interview' }],
    ['chat', '/api/chat', { messages: [], sessionId: crypto.randomUUID(), idempotencyKey: 'invalid:chat' }],
    ['terms', '/api/terms', { text: 42, idempotencyKey: 'invalid:terms' }],
    ['knowledge', '/api/knowledge-graph', { nodeId: '', x: 'left', y: 0, idempotencyKey: 'invalid:knowledge' }],
  ])('%s 非法输入返回统一 400', async (name, pathname, body) => {
    const handler = handlers[name];
    const response = await handler(jsonRequest(pathname, body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: '请求参数不符合要求',
      },
    });
  });

  it('无效 JSON 返回统一错误结构', async () => {
    const response = await resourcesPost(
      new Request('http://localhost/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_JSON', message: '请求体必须是有效 JSON' },
    });
  });

  it('重复资源请求返回同一对象且数据库只有一条记录', async () => {
    const body = {
      title: 'MDN HTTP 缓存',
      type: '文档',
      url: 'https://developer.mozilla.org/docs/Web/HTTP/Caching',
      termId: null,
      idempotencyKey: 'route:resource:duplicate',
    };
    const first = await resourcesPost(jsonRequest('/api/resources', body));
    const second = await resourcesPost(jsonRequest('/api/resources', body));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const firstBody = (await first.json()) as { resource: { id: string }; duplicate: boolean };
    const secondBody = (await second.json()) as { resource: { id: string }; duplicate: boolean };
    expect(firstBody.duplicate).toBe(false);
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.resource.id).toBe(firstBody.resource.id);
    expect(repository.listResources().filter((resource) => resource.id === firstBody.resource.id)).toHaveLength(1);
  });
});
