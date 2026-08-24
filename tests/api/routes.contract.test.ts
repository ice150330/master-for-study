import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type PostHandler = (request: Request) => Promise<Response>;
type GetHandler = (request: Request) => Promise<Response>;

let tempDir: string;
let repository: typeof import('../../src/lib/db');
let resourcesPost: PostHandler;
let reviewPost: PostHandler;
let eventsPost: PostHandler;
let sessionsPost: PostHandler;
let settingsPatch: PostHandler;
let notesPost: PostHandler;
let interviewPost: PostHandler;
let chatPost: PostHandler;
let termsPost: PostHandler;
let knowledgePatch: PostHandler;
let analyticsGet: GetHandler;
let exportGet: GetHandler;
let workspacesPost: PostHandler;
let workspacesGet: GetHandler;
// [id] 路由带动态段上下文（Next 16 的 params 是 Promise）
let workspacesPatch: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let reviewGet: GetHandler;
let importPost: PostHandler;
let conceptsPatch: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
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
  settingsPatch = (await import('../../src/app/api/settings/route')).PATCH;
  sessionsPost = (await import('../../src/app/api/sessions/route')).POST;
  notesPost = (await import('../../src/app/api/notes/route')).POST;
  interviewPost = (await import('../../src/app/api/interview/route')).POST;
  chatPost = (await import('../../src/app/api/chat/route')).POST;
  termsPost = (await import('../../src/app/api/terms/route')).POST;
  knowledgePatch = (await import('../../src/app/api/knowledge-graph/route')).PATCH;
  analyticsGet = (await import('../../src/app/api/analytics/route')).GET;
  exportGet = (await import('../../src/app/api/export/route')).GET;
  workspacesPost = (await import('../../src/app/api/workspaces/route')).POST;
  workspacesGet = (await import('../../src/app/api/workspaces/route')).GET;
  workspacesPatch = (await import('../../src/app/api/workspaces/[id]/route')).PATCH;
  reviewGet = (await import('../../src/app/api/review/route')).GET;
  importPost = (await import('../../src/app/api/import/route')).POST;
  conceptsPatch = (await import('../../src/app/api/concepts/[id]/route')).PATCH;
  handlers = {
    resources: resourcesPost,
    review: reviewPost,
    events: eventsPost,
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

  it('分析接口只接受 7 天或 30 天范围', async () => {
    const invalid = await analyticsGet(new Request('http://localhost/api/analytics?days=14'));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const valid = await analyticsGet(new Request('http://localhost/api/analytics?days=7'));
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({
      analytics: { rangeDays: 7, trend: expect.any(Array), metrics: expect.any(Array) },
    });
  });

  it('设置接口非法风格返回统一 400，合法部分更新生效', async () => {
    const invalid = await settingsPatch(
      new Request('http://localhost/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherStyle: 'wizard' }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const valid = await settingsPatch(
      new Request('http://localhost/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherStyle: 'feynman' }),
      }),
    );
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({ settings: { teacherStyle: 'feynman' } });
  });

  it('复习摘要接口返回轻量负荷（A4 提醒轮询用）', async () => {
    const response = await reviewGet(new Request('http://localhost/api/review?summary=1'));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      summary: { due: number; overdue: number; estimatedMinutes: number };
      pendingCount: number;
    };
    expect(data.summary).toMatchObject({ due: expect.any(Number), overdue: expect.any(Number) });
    expect(typeof data.pendingCount).toBe('number');
    // 轻量模式不返回完整队列
    expect('reviews' in data).toBe(false);
  });

  it('导入接口：非法结构 400，导出快照可整库回灌（B1）', async () => {
    const invalid = await importPost(jsonRequest('/api/import', { tables: 'not-an-object' }));
    expect(invalid.status).toBe(400);

    // 用导出接口拿当前快照回灌（往返一致性）
    const exportResponse = await exportGet(new Request('http://localhost/api/export'));
    const snapshot = (await exportResponse.json()) as { generatedAt: string; tables: Record<string, unknown[]> };
    const restored = await importPost(jsonRequest('/api/import', snapshot));
    expect(restored.status).toBe(200);
    const body = (await restored.json()) as { imported: Record<string, number>; total: number };
    expect(body.imported.workspaces).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThan(0);

    // 未知表键返回 400 且带原因
    const unknownTable = await importPost(jsonRequest('/api/import', {
      generatedAt: snapshot.generatedAt,
      tables: { ...snapshot.tables, bogus: [] },
    }));
    expect(unknownTable.status).toBe(400);
    expect(await unknownTable.json()).toMatchObject({ error: { code: 'IMPORT_INVALID' } });
  });

  it('概念定义修正：非法长度 400，合法修正后读取生效（B2）', async () => {
    // 合同库没有术语，直接经仓库层造一个（绕开需要真实 AI 调用的 /api/terms）
    const term = repository.upsertTerm({
      name: 'B2 合同概念',
      definition: '原始定义。',
      idempotencyKey: 'term:contract:b2',
    });
    const termId = term.id;

    const invalid = await conceptsPatch(
      jsonRequest(`/api/concepts/${termId}`, { definition: '短' }),
      { params: Promise.resolve({ id: termId }) },
    );
    expect(invalid.status).toBe(400);

    const valid = await conceptsPatch(
      jsonRequest(`/api/concepts/${termId}`, { definition: '合同测试修正后的定义，长度足够。' }),
      { params: Promise.resolve({ id: termId }) },
    );
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({
      concept: { id: termId, definition: '合同测试修正后的定义，长度足够。' },
    });

    const missing = await conceptsPatch(
      jsonRequest(`/api/concepts/${crypto.randomUUID()}`, { definition: '不存在的概念定义修正。' }),
      { params: Promise.resolve({ id: crypto.randomUUID() }) },
    );
    expect(missing.status).toBe(404);
  });

  it('导出接口返回带附件头的完整 JSON', async () => {
    const response = await exportGet(new Request('http://localhost/api/export'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="mentor-export-\d{4}-\d{2}-\d{2}\.json"$/);
    const data = (await response.json()) as { generatedAt: string; tables: Record<string, unknown[]> };
    expect(Object.keys(data.tables).length).toBeGreaterThanOrEqual(20);
    expect(data.tables.workspaces.length).toBeGreaterThan(0);
    // Date 已序列化为 ISO 字符串
    expect(typeof data.generatedAt).toBe('string');
    expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('工作区接口：非法标题 400、新建即激活、切换不存在 404', async () => {
    const invalid = await workspacesPost(jsonRequest('/api/workspaces', { title: '' }));
    expect(invalid.status).toBe(400);

    const created = await workspacesPost(jsonRequest('/api/workspaces', { title: '合同测试主题' }));
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { workspace: { id: string; isActive: boolean } };
    expect(createdBody.workspace.isActive).toBe(true);

    const listResponse = await workspacesGet(new Request('http://localhost/api/workspaces'));
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      workspaces: Array<{ id: string; title: string; isActive: boolean }>;
      activeId: string | null;
    };
    expect(listed.workspaces.length).toBeGreaterThanOrEqual(2);
    expect(listed.activeId).toBe(createdBody.workspace.id);

    const missing = await workspacesPatch(
      jsonRequest(`/api/workspaces/${crypto.randomUUID()}`, { activate: true }),
      { params: Promise.resolve({ id: crypto.randomUUID() }) },
    );
    expect(missing.status).toBe(404);

    // 收尾：切回原工作区，不影响后续断言
    const restore = listed.workspaces.find((workspace) => workspace.id !== createdBody.workspace.id);
    if (restore) {
      const restored = await workspacesPatch(
        jsonRequest(`/api/workspaces/${restore.id}`, { activate: true }),
        { params: Promise.resolve({ id: restore.id }) },
      );
      expect(restored.status).toBe(200);
    }
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
