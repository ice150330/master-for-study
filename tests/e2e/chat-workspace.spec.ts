import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '05-chat-workspace';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

type SessionFixture = {
  id: string;
  parentId: string | null;
  title: string;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

test('会话工作区支持历史术语、搜索和完整管理流程', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 5 以桌面会话工作区为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const active: SessionFixture[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      parentId: null,
      title: 'HTTP 缓存策略',
      pinnedAt: null,
      archivedAt: null,
      createdAt: '2026-08-14T08:00:00.000Z',
      updatedAt: '2026-08-15T00:10:00.000Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      parentId: null,
      title: 'SQL 聚合查询',
      pinnedAt: null,
      archivedAt: null,
      createdAt: '2026-08-13T08:00:00.000Z',
      updatedAt: '2026-08-14T20:00:00.000Z',
    },
  ];
  const archived: SessionFixture[] = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      parentId: null,
      title: '已归档的 DNS 学习',
      pinnedAt: null,
      archivedAt: '2026-08-14T21:00:00.000Z',
      createdAt: '2026-08-12T08:00:00.000Z',
      updatedAt: '2026-08-14T21:00:00.000Z',
    },
  ];

  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({ json: { sessions: active, archivedSessions: archived } });
  });
  await page.route('**/api/sessions/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const method = route.request().method();
    const session = [...active, ...archived].find((item) => item.id === id);
    if (method === 'GET') {
      await route.fulfill({
        json: {
          session,
          messages:
            id === '11111111-1111-4111-8111-111111111111'
              ? [
                  {
                    id: 'message-user-1',
                    role: 'user',
                    content: 'Cache-Control 有什么作用？',
                    status: 'complete',
                  },
                  {
                    id: 'message-assistant-1',
                    role: 'assistant',
                    content: '[[Cache-Control]] 用于声明缓存策略。',
                    status: 'complete',
                  },
                ]
              : [],
          terms:
            id === '11111111-1111-4111-8111-111111111111'
              ? [
                  {
                    name: 'Cache-Control',
                    definition: '控制浏览器和中间缓存如何复用响应。',
                    sources: [{ messageId: 'message-assistant-1', sessionId: id }],
                  },
                ]
              : [],
        },
      });
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (method === 'PATCH' && session) {
      if (body.action === 'rename') session.title = String(body.title);
      if (body.action === 'pin') session.pinnedAt = body.pinned ? new Date().toISOString() : null;
      if (body.action === 'archive') {
        if (body.archived) {
          active.splice(active.indexOf(session), 1);
          session.archivedAt = new Date().toISOString();
          archived.unshift(session);
        } else {
          archived.splice(archived.indexOf(session), 1);
          session.archivedAt = null;
          active.unshift(session);
        }
      }
      await route.fulfill({ json: { session } });
      return;
    }
    if (method === 'DELETE' && session) {
      const activeIndex = active.indexOf(session);
      if (activeIndex >= 0) active.splice(activeIndex, 1);
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: 'SESSION_NOT_FOUND', message: '会话不存在' } } });
  });
  await page.route('**/api/concepts?*', async (route) => {
    await route.fulfill({
      json: {
        concept: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Cache-Control',
          canonicalName: 'Cache-Control',
          aliases: [],
          definition: '控制浏览器和中间缓存如何复用响应。',
          example: '例如 max-age=3600 允许响应在一小时内复用。',
          confidence: 0.96,
        },
        mastery: { state: 'learning' },
        mentions: [],
        relatedNotes: [],
        relatedResources: [],
      },
    });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'HTTP 缓存策略' })).toBeVisible();
  const term = page.getByRole('button', { name: '打开概念：Cache-Control' });
  await term.click();
  await expect(page.getByText('控制浏览器和中间缓存如何复用响应。')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-history-term-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  // 概念便利贴是 modal 弹层，打开时背景被 aria-hidden——先关掉再操作页头
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // 树气泡触发钮（悬停/点击皆开；锚定正则避开分支堆「还有 N 个…打开会话树」溢出钮）
  await page.getByRole('button', { name: /^打开会话树/ }).click();
  const search = page.getByRole('textbox', { name: '搜索会话' });
  const treePanel = page.locator('.tree-bubble');
  await search.fill('SQL');
  // 限定在树气泡内断言：底部路径条的当前会话钮不受搜索影响
  await expect(treePanel.getByRole('button', { name: 'SQL 聚合查询' })).toBeVisible();
  await expect(treePanel.getByRole('button', { name: 'HTTP 缓存策略' })).toHaveCount(0);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-session-search-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await search.fill('');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('menuitem', { name: '重命名' }).click();
  const titleInput = page.getByRole('textbox', { name: '会话标题' });
  await titleInput.fill('HTTP 缓存与协商');
  await page.getByRole('button', { name: '保存标题' }).click();
  await expect(page.getByRole('heading', { name: 'HTTP 缓存与协商' })).toBeVisible();

  await page.getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('menuitem', { name: '置顶会话' }).click();
  await page.getByRole('button', { name: /^打开会话树/ }).click();
  await expect(page.getByLabel('已置顶')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('menuitem', { name: '删除' }).click();
  await expect(page.getByRole('dialog', { name: '删除会话' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-delete-confirm-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '取消' }).click();

  await page.getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('menuitem', { name: '归档' }).click();
  await expect(page.getByRole('heading', { name: 'SQL 聚合查询' })).toBeVisible();
  await page.getByRole('button', { name: /^打开会话树/ }).click();
  await expect(page.getByText('HTTP 缓存与协商')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-archived-session-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '恢复会话 HTTP 缓存与协商' }).click();
  await expect(page.getByRole('heading', { name: 'HTTP 缓存与协商' })).toBeVisible();

  await page.getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('menuitem', { name: '删除' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('heading', { name: 'SQL 聚合查询' })).toBeVisible();
});
