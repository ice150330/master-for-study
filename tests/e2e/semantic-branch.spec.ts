import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '06-semantic-branch';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

const rootId = '11111111-1111-4111-8111-111111111111';
const siblingId = '22222222-2222-4222-8222-222222222222';
const childId = '33333333-3333-4333-8333-333333333333';
const workerSiblingId = '44444444-4444-4444-8444-444444444444';
const cdnSiblingId = '55555555-5555-4555-8555-555555555555';
const anchorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('术语和消息锚点创建可回溯的语义分支', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 6 以 1440 桌面视口验收动效与路径');
  await fs.mkdir(captureRoot, { recursive: true });

  const root = session(rootId, null, 'HTTP 缓存策略');
  const sibling = session(siblingId, rootId, '协商缓存', anchorId);
  const workerSibling = session(workerSiblingId, rootId, 'Service Worker 缓存', anchorId);
  const cdnSibling = session(cdnSiblingId, rootId, 'CDN 重新验证', anchorId);
  const child = session(childId, rootId, '从消息继续', anchorId);
  const sessions = [root, sibling, workerSibling, cdnSibling];

  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({ forkedFromMessageId: anchorId });
      expect(body).not.toHaveProperty('parentId');
      sessions.unshift(child);
      await route.fulfill({ status: 201, json: { session: child } });
      return;
    }
    await route.fulfill({ json: { sessions, archivedSessions: [] } });
  });

  await page.route('**/api/sessions/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const current = sessions.find((item) => item.id === id);
    await route.fulfill({
      json: {
        session: current,
        messages:
          id === rootId
            ? [
                {
                  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  role: 'user',
                  content: '浏览器如何决定能不能使用缓存？',
                  status: 'complete',
                },
                {
                  id: anchorId,
                  role: 'assistant',
                  content: '响应中的 [[Cache-Control]] 会声明缓存复用规则。',
                  status: 'complete',
                },
              ]
            : id === siblingId
              ? [
                  {
                    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                    role: 'assistant',
                    content: '协商缓存会使用 ETag 或 Last-Modified。',
                    status: 'complete',
                  },
                ]
              : [],
        terms:
          id === rootId
            ? [
                {
                  name: 'Cache-Control',
                  definition: '用于声明缓存策略和复用条件的 HTTP 响应头。',
                  sources: [{ messageId: anchorId, sessionId: rootId }],
                },
              ]
            : [],
      },
    });
  });

  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).toMatchObject({ sessionId: childId });
    expect(body.message).toContain('请从这条消息继续深入');
    expect(body).not.toHaveProperty('messages');
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: '在刚才的缓存讨论里，[[Cache-Control]] 决定响应能否直接复用。',
    });
  });
  await page.route('**/api/terms', async (route) => {
    await route.fulfill({
      json: {
        terms: [{ name: 'Cache-Control', definition: '用于声明缓存复用规则。' }],
      },
    });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'HTTP 缓存策略' })).toBeVisible();
  const branchStack = page.getByRole('group', { name: /分支会话/ });
  await expect(branchStack).toBeVisible();
  await expect(branchStack.getByTitle('回到：协商缓存')).toBeVisible();
  await expect(branchStack.getByTitle('回到：Service Worker 缓存')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-before-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  // 悬停展开：胶带松开叠压（margin 释放）并淡入标题（max-width 过渡）
  const firstBranch = branchStack.getByTitle('回到：协商缓存');
  const secondBranch = branchStack.getByTitle('回到：Service Worker 缓存');
  const restingMargin = await secondBranch.evaluate((element) => getComputedStyle(element).marginRight);
  await firstBranch.hover();
  await page.waitForTimeout(380);
  await expect(firstBranch.getByText('协商缓存')).toBeVisible();
  const expandedMargin = await secondBranch.evaluate((element) => getComputedStyle(element).marginRight);
  expect(expandedMargin).not.toBe(restingMargin);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-hover-stack-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  const animationStyle = await page.addStyleTag({
    content: '.animate-session-enter { animation-duration: 3s !important; }',
  });
  const anchorMessage = page.locator(`[data-message-id="${anchorId}"]`);
  await anchorMessage.hover();
  await anchorMessage.getByRole('button', { name: '从这条回答派生新分支继续提问' }).click();
  await expect(page.getByRole('heading', { name: '从消息继续' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '会话树路径' })).toBeVisible();
  await page.waitForTimeout(90);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-motion-mid-${testInfo.project.name}.png`),
  });
  await animationStyle.evaluate((element) => element.parentNode?.removeChild(element));

  await expect(page.getByText(/请从这条消息继续深入/)).toBeVisible();
  await expect(page.getByText(/决定响应能否直接复用/)).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-after-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  const parentCard = page.getByTitle('回到：HTTP 缓存策略');
  await parentCard.hover();
  await page.waitForTimeout(380);
  // 父级胶带沿上缘一行排布，标题常显（收起展开只发生在分支堆）
  await expect(parentCard.getByText('HTTP 缓存策略')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-hover-ancestor-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await parentCard.click();
  // 切到根后分支堆含 4 个分支、收起时相互叠压：先悬停展开整叠再点目标分支
  const branchSwitch = page.getByTitle('回到：协商缓存');
  await branchStack.hover();
  await page.waitForTimeout(380);
  await branchSwitch.click();
  await expect(page.getByRole('heading', { name: '协商缓存' })).toBeVisible();
  await expect(page.getByText('协商缓存会使用 ETag 或 Last-Modified。')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-sibling-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
});

test('1024 宽度保留直接卡片堆且不遮挡输入区', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-1024x768', '仅验收 1024 桌面工作区');
  await fs.mkdir(captureRoot, { recursive: true });
  const root = session(rootId, null, 'HTTP 缓存策略');
  const child = {
    ...session(childId, rootId, '术语：Cache-Control', anchorId),
    updatedAt: '2026-08-15T00:10:00.000Z',
  };
  await page.route('**/api/sessions', (route) =>
    route.fulfill({ json: { sessions: [child, root], archivedSessions: [] } }),
  );
  await page.route('**/api/sessions/*', (route) =>
    route.fulfill({
      json: {
        session: child,
        messages: [
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            role: 'assistant',
            content: '分支仍然保留清晰的输入区域和回溯路径。',
            status: 'complete',
          },
        ],
        terms: [],
      },
    }),
  );

  await page.goto('/', { waitUntil: 'networkidle' });
  const pathNavigation = page.getByRole('navigation', { name: '会话树路径' });
  await expect(pathNavigation).toBeVisible();
  await expect(pathNavigation.getByRole('button', { name: /HTTP 缓存策略/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /输入问题/ })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-direct-stack-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
});

function session(id: string, parentId: string | null, title: string, forkedFromMessageId?: string) {
  return {
    id,
    parentId,
    rootSessionId: rootId,
    forkedFromMessageId: forkedFromMessageId ?? null,
    title,
    pinnedAt: null,
    archivedAt: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  };
}
