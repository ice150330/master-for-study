import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '07-concept-rail';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const sessionId = '11111111-1111-4111-8111-111111111111';
const messageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conceptId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('Concept 触发器支持键盘并打开多来源上下文轨道', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 7 以桌面上下文轨道为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });

  const session = {
    id: sessionId,
    parentId: null,
    rootSessionId: sessionId,
    forkedFromMessageId: null,
    title: 'HTTP 缓存策略',
    pinnedAt: null,
    archivedAt: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T01:00:00.000Z',
  };
  const branchSession = {
    ...session,
    id: '22222222-2222-4222-8222-222222222222',
    parentId: sessionId,
    forkedFromMessageId: messageId,
    title: '协商缓存',
  };
  await page.route('**/api/sessions', (route) =>
    route.fulfill({ json: { sessions: [session, branchSession], archivedSessions: [] } }),
  );
  await page.route('**/api/sessions/*', (route) =>
    route.fulfill({
      json: {
        session,
        messages: [
          {
            id: messageId,
            role: 'assistant',
            content: '[[Cache-Control]] 会声明缓存的复用条件和有效时间。',
            status: 'complete',
          },
        ],
        terms: [
          {
            name: 'Cache-Control',
            definition: '用于声明缓存策略的 HTTP 响应头。',
            sources: [{ messageId, sessionId }],
          },
        ],
      },
    }),
  );
  await page.route('**/api/concepts?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 260));
    await route.fulfill({
      json: {
        concept: {
          id: conceptId,
          name: 'Cache-Control',
          canonicalName: 'HTTP Cache-Control',
          aliases: ['缓存控制', 'Cache Control'],
          definition: '用于声明响应能否缓存、可缓存多久以及由谁缓存。',
          example: 'Cache-Control: max-age=3600 表示响应可复用一小时。',
          confidence: 0.96,
        },
        mastery: { state: 'learning' },
        mentions: [
          {
            id: 'mention-message',
            sourceType: 'message',
            sourceId: messageId,
            sessionId,
            excerpt: 'Cache-Control 会声明缓存的复用条件和有效时间。',
            sourceTitle: 'HTTP 缓存策略',
          },
          {
            id: 'mention-note',
            sourceType: 'note',
            sourceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            sessionId,
            excerpt: '缓存策略学习笔记',
            sourceTitle: '缓存策略笔记',
          },
          {
            id: 'mention-resource',
            sourceType: 'resource',
            sourceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            sessionId: null,
            excerpt: 'MDN Cache-Control reference',
            sourceTitle: 'MDN Cache-Control',
          },
        ],
        relatedNotes: [
          { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: '缓存策略笔记', sessionId },
        ],
        relatedResources: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            title: 'MDN Cache-Control',
            url: 'https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control',
            status: '在读',
          },
        ],
      },
    });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  const trigger = page.getByRole('button', { name: '打开概念：Cache-Control' });
  await trigger.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('陌生知识点');
  await expect(tooltip).toContainText('用于声明缓存策略的 HTTP 响应头。');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-term-hover-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.mouse.move(0, 0);
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-keyboard-focus-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await trigger.press('Enter');
  await expect(page.getByText('正在整理定义与来源')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-loading-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await expect(page.getByRole('heading', { name: 'HTTP Cache-Control' })).toBeVisible();
  const branchStack = page.getByRole('complementary', { name: '后续分支' });
  await expect(branchStack).toBeVisible();
  await expect(branchStack.getByTitle('切到分支：协商缓存')).toBeVisible();
  await expect(page.getByText('置信度 96%')).toBeVisible();
  await expect(page.getByRole('link', { name: '缓存策略笔记' })).toBeVisible();
  await expect(page.getByText('MDN Cache-Control', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '创建笔记' })).toHaveAttribute(
    'href',
    new RegExp(`/notes\\?concept=${conceptId}.*source=message%3A`),
  );
  await expect(page.getByRole('link', { name: '模拟测验' })).toHaveAttribute(
    'href',
    new RegExp(`/interview\\?concept=${conceptId}.*source=message%3A`),
  );
  await expect(page.getByRole('link', { name: '加入复习' })).toHaveAttribute(
    'href',
    new RegExp(`/review\\?concept=${conceptId}.*source=message%3A`),
  );
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-multi-source-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: /HTTP 缓存策略/ }).last().click();
  await expect(page.locator(`[data-message-id="${messageId}"]`)).toBeVisible();
  await page.getByRole('button', { name: '关闭概念详情' }).click();
  await expect(page.getByRole('heading', { name: 'HTTP Cache-Control' })).toHaveCount(0);
});
