import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '13-resource-knowledge-inbox';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const now = '2026-08-15T03:05:00.000Z';
const ids = {
  resource: '71111111-1111-4111-8111-111111111111',
  workspace: '81111111-1111-4111-8111-111111111111',
  session: '91111111-1111-4111-8111-111111111111',
  ai: '7aea98fd-46a5-4ead-a180-a6d1a691c06c',
  python: '083bdca7-69a3-4cb8-a347-be3d3275c196',
};

test('资源收件箱完成元数据、多概念、去重、进度、摘录与筛选', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 13 以桌面资源工作台为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  const resource = makeResource();
  let createCount = 0;

  await page.route('**/api/resources/metadata', async (route) => route.fulfill({
    json: {
      metadata: {
        title: 'SQLite FTS5 全文检索指南',
        canonicalUrl: 'https://www.sqlite.org/fts5.html',
        siteName: 'SQLite Documentation',
        author: 'SQLite Project',
        description: '介绍 FTS5 全文检索表、查询语法与排序能力。',
        faviconUrl: 'https://www.sqlite.org/favicon.ico',
        type: '文档',
      },
    },
  }));
  await page.route('**/api/resources/highlights', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const highlight = {
      id: 'a1111111-1111-4111-8111-111111111111',
      resourceId: ids.resource,
      excerpt: String(body.excerpt),
      note: String(body.note),
      locator: String(body.locator),
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    resource.highlights.unshift(highlight);
    await route.fulfill({ status: 201, json: { highlight } });
  });
  await page.route('**/api/resources', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      createCount += 1;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const conceptIds = [...new Set([
        ...resource.concepts.map((concept) => concept.id),
        ...(body.conceptIds as string[]),
      ])];
      resource.concepts = conceptIds.map((id) => ({
        id,
        name: id === ids.ai ? 'AI' : 'Python',
      }));
      resource.tags = [...new Set([...resource.tags, ...((body.tags as string[]) ?? [])])];
      resource.note = String(body.note || resource.note);
      await route.fulfill({ status: createCount === 1 ? 201 : 200, json: { resource, duplicate: createCount > 1 } });
      return;
    }
    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      resource.progress = Number(body.progress);
      resource.status = body.status as typeof resource.status;
      await route.fulfill({ json: { resource } });
      return;
    }
    await route.fulfill({ json: { resources: [resource] } });
  });

  await page.goto('/resources', { waitUntil: 'networkidle' });
  await expect(page.getByText('当前视图没有资源')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-empty-${testInfo.project.name}.png`), animations: 'disabled' });

  await addResource(page, ['AI', 'Python']);
  await expect(page.getByRole('heading', { name: resource.title })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AI' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Python' })).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-detail-${testInfo.project.name}.png`), animations: 'disabled' });

  await addResource(page, ['AI']);
  await expect(page.getByText('已合并重复链接')).toBeVisible();
  await expect(page.getByRole('heading', { name: resource.title })).toHaveCount(1);
  await page.screenshot({ path: path.join(captureRoot, `${phase}-duplicate-merged-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '添加摘录' }).click();
  await page.getByRole('textbox', { name: '摘录原文' }).fill('FTS5 provides full-text search functionality to database applications.');
  await page.getByRole('textbox', { name: '来源定位' }).fill('Overview of FTS5');
  await page.getByRole('textbox', { name: '摘录注释' }).fill('适合先作为本地检索的第一阶段。');
  await page.getByRole('button', { name: '保存摘录' }).click();
  await expect(page.getByText('FTS5 provides full-text search functionality')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-highlight-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('slider', { name: '阅读进度' }).fill('45');
  await page.getByRole('button', { name: '保存进度' }).click();
  await expect(page.getByText('45%', { exact: true }).first()).toBeVisible();
  await page.getByLabel('资源学习状态').getByRole('button', { name: '在读', exact: true }).click();
  await expect(page.getByRole('tab', { name: /在读 1/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '全文检索', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索资源' }).fill('Python');
  await expect(page.getByRole('heading', { name: resource.title })).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-reading-filter-${testInfo.project.name}.png`), animations: 'disabled' });
});

test('聊天显式选择资源并在刷新后保留引用来源', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 13 以桌面聊天引用为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  const resource = makeResource();
  const session = {
    id: ids.session,
    parentId: null,
    forkedFromMessageId: null,
    title: '基于资料学习 FTS5',
    pinnedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  let sentBody: Record<string, unknown> | null = null;
  let history: Array<Record<string, unknown>> = [];

  await page.route('**/api/resources', async (route) => route.fulfill({ json: { resources: [resource] } }));
  await page.route('**/api/sessions', async (route) => route.fulfill({ json: { sessions: [session], archivedSessions: [] } }));
  await page.route('**/api/sessions/*', async (route) => route.fulfill({
    json: { session, messages: history, terms: [] },
  }));
  await page.route('**/api/terms', async (route) => route.fulfill({ json: { terms: [] } }));
  await page.route('**/api/chat', async (route) => {
    sentBody = route.request().postDataJSON() as Record<string, unknown>;
    history = [
      { id: 'b1111111-1111-4111-8111-111111111111', role: 'user', content: String(sentBody.message), status: 'complete' },
      {
        id: 'c1111111-1111-4111-8111-111111111111',
        role: 'assistant',
        content: '可以先用 FTS5 建立本地全文索引，再依据查询结果补充向量召回。[来源 1]',
        status: 'complete',
        sources: [{ id: resource.id, title: resource.title, url: resource.url, type: resource.type }],
      },
    ];
    await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: history[1].content as string });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '引用资源' }).click();
  await page.getByRole('button', { name: new RegExp(resource.title) }).click();
  await expect(page.getByLabel('本轮已选资源')).toContainText(resource.title);
  await page.getByPlaceholder('输入问题，Enter 发送 / Shift+Enter 换行').fill('结合资料给我一个本地检索实施顺序');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByText('引用来源')).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(resource.title) })).toBeVisible();
  expect(sentBody).toMatchObject({ resourceIds: [ids.resource] });
  await page.screenshot({ path: path.join(captureRoot, `${phase}-chat-citation-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('引用来源')).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(resource.title) })).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-chat-citation-reloaded-${testInfo.project.name}.png`), animations: 'disabled' });
});

async function addResource(page: import('@playwright/test').Page, concepts: string[]) {
  await page.getByRole('button', { name: '添加资源' }).click();
  await page.getByRole('textbox', { name: '资源链接' }).fill('https://www.sqlite.org/fts5.html?utm_source=mentor');
  await page.getByRole('button', { name: '读取信息' }).click();
  for (const concept of concepts) await page.getByRole('button', { name: concept, exact: true }).click();
  await page.getByLabel('标签').fill('数据库, 全文检索');
  await page.getByRole('textbox', { name: '文档笔记' }).fill('验证 FTS5 是否适合作为本地知识检索的第一阶段。');
  await page.getByRole('button', { name: '加入收件箱' }).click();
}

function makeResource() {
  return {
    id: ids.resource,
    workspaceId: ids.workspace,
    termId: ids.ai,
    title: 'SQLite FTS5 全文检索指南',
    type: '文档' as const,
    url: 'https://www.sqlite.org/fts5.html',
    canonicalUrl: 'https://www.sqlite.org/fts5.html',
    siteName: 'SQLite Documentation',
    author: 'SQLite Project',
    description: '介绍 FTS5 全文检索表、查询语法与排序能力。',
    faviconUrl: 'https://www.sqlite.org/favicon.ico',
    status: '想读' as '想读' | '在读' | '已读',
    progress: 0,
    tags: [] as string[],
    note: null as string | null,
    createdAt: now,
    updatedAt: now,
    concepts: [] as Array<{ id: string; name: string }>,
    highlights: [] as Array<Record<string, unknown>>,
  };
}
