import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? 'final';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const rootId = '11111111-1111-4111-8111-111111111111';
const childId = '22222222-2222-4222-8222-222222222222';
const anchorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conceptId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test.beforeEach(async () => {
  await fs.mkdir(captureRoot, { recursive: true });
});

test('今日到分析的核心学习闭环保留同一概念与来源', async ({ page }, testInfo) => {
  test.skip(!['desktop-1440x900', 'tablet-1024x768'].includes(testInfo.project.name), '完整闭环以两档桌面视口验收');
  const state = await installJourneyRoutes(page);

  await page.goto('/dev/today', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('mentor-today-later'));
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '继续：HTTP 缓存策略' })).toBeVisible();
  await capture(page, `01-today-${testInfo.project.name}`);

  await page.getByRole('link', { name: /继续学习/ }).click();
  await expect(page.getByRole('heading', { name: 'HTTP 缓存策略' })).toBeVisible();
  await expect(page.getByRole('button', { name: '打开概念：Cache-Control' })).toBeVisible();
  await capture(page, `02-chat-${testInfo.project.name}`);

  await page.getByRole('button', { name: '打开概念：Cache-Control' }).click();
  await expect(page.getByRole('complementary', { name: '概念详情' })).toContainText('缓存复用与重新验证');
  await expect(page).toHaveURL(new RegExp(`concept=${conceptId}`));
  await capture(page, `03-concept-${testInfo.project.name}`);

  await page.getByRole('button', { name: '继续追问' }).click();
  await expect(page.getByRole('heading', { name: '概念：Cache-Control' })).toBeVisible();
  await expect(page.getByText('共享前缀已经继承')).toBeVisible();
  await expect(page.getByRole('complementary', { name: '概念详情' })).toBeHidden();
  expect(state.branchRequest).toMatchObject({ forkedFromMessageId: anchorId });
  await capture(page, `04-semantic-branch-${testInfo.project.name}`);

  await page.getByRole('button', { name: '打开概念：Cache-Control' }).click();
  await expect(page.getByRole('complementary', { name: '概念详情' })).toBeVisible();
  await expect(page).toHaveURL(/source=message%3A/);
  const interviewHref = await page.getByRole('link', { name: '模拟测验' }).getAttribute('href');
  expect(interviewHref).toBeTruthy();
  const interviewUrl = new URL(interviewHref!, page.url());
  expect(interviewUrl.pathname).toBe('/interview');
  expect(interviewUrl.searchParams.get('concept')).toBe(conceptId);
  expect(interviewUrl.searchParams.get('source')).toMatch(/^message:/);
  const reviewHref = await page.getByRole('link', { name: '加入复习' }).getAttribute('href');
  expect(reviewHref).toBeTruthy();
  const contextQuery = new URL(reviewHref!, page.url()).searchParams.toString();
  await page.goto(`/dev/review?${contextQuery}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('learning-context-bar')).toContainText('Cache-Control');
  await page.getByRole('textbox', { name: '主动回忆' }).fill('缓存由显式新鲜度和验证器共同决定能否复用。');
  await page.getByRole('button', { name: '查看答案' }).click();
  await page.getByRole('button', { name: /记得/ }).click();
  await expect(page.getByText('已安排在 3 天后', { exact: true })).toBeVisible();
  await capture(page, `05-review-${testInfo.project.name}`);

  await page.getByRole('link', { name: '成长分析' }).click();
  await expect(page).toHaveURL(new RegExp(`/analytics\?.*concept=${conceptId}`));
  await expect(page.getByRole('heading', { name: '成长分析' })).toBeVisible();
  await expect(page.getByTestId('activity-trend')).toBeVisible();
  await expect(page.getByTestId('learning-context-bar')).toContainText('Cache-Control');
  await capture(page, `06-analytics-${testInfo.project.name}`);
});

test('390 仅保留今日与复习的基础可用截图', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390x844', '手机端不做完整闭环精修');
  await page.goto('/dev/today', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('mentor-today-later'));
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('navigation', { name: '移动端区域导航' })).toBeVisible();
  await capture(page, `08-today-${testInfo.project.name}`);

  await page.goto('/dev/review', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '缓存一致性' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '移动端区域导航' })).toBeVisible();
  await capture(page, `09-review-${testInfo.project.name}`);
});

async function installJourneyRoutes(page: Page) {
  const root = session(rootId, null, 'HTTP 缓存策略');
  const child = session(childId, rootId, '概念：Cache-Control', anchorId);
  const sessions = [root];
  const state: {
    branchRequest: Record<string, unknown> | null;
  } = { branchRequest: null };

  await page.route('**/api/resources', (route) => route.fulfill({ json: { resources: [] } }));
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      state.branchRequest = route.request().postDataJSON() as Record<string, unknown>;
      if (!sessions.some((item) => item.id === childId)) sessions.unshift(child);
      await route.fulfill({ status: 201, json: { session: child } });
      return;
    }
    await route.fulfill({ json: { sessions, archivedSessions: [] } });
  });
  await page.route('**/api/sessions/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    await route.fulfill({
      json: {
        session: id === childId ? child : root,
        messages: id === childId ? [] : [
          { id: 'message-user', role: 'user', content: '浏览器什么时候可以直接使用缓存？', status: 'complete' },
          { id: anchorId, role: 'assistant', content: '响应中的 [[Cache-Control]] 会声明缓存复用与重新验证规则。', status: 'complete' },
        ],
        terms: id === childId ? [] : [{
          name: 'Cache-Control',
          definition: '用于声明缓存复用与重新验证规则的 HTTP 响应头。',
          sources: [{ messageId: anchorId, sessionId: rootId }],
        }],
      },
    });
  });
  await page.route('**/api/concepts?*', (route) => route.fulfill({ json: conceptFixture() }));
  await page.route('**/api/chat', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ sessionId: childId });
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: '共享前缀已经继承；[[Cache-Control]] 在这里负责规定缓存何时可复用。',
    });
  });
  await page.route('**/api/terms', (route) => route.fulfill({
    json: { terms: [{ name: 'Cache-Control', definition: '用于声明缓存复用规则。' }] },
  }));
  await page.route('**/api/review', async (route) => {
    await route.fulfill({ json: { next: { logId: 'final-review-log', intervalLabel: '3 天' } } });
  });
  return state;
}

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-${name}.png`),
    animations: 'disabled',
    caret: 'initial',
  });
}

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

function conceptFixture() {
  return {
    concept: {
      id: conceptId,
      name: 'Cache-Control',
      canonicalName: 'Cache-Control',
      aliases: ['缓存控制'],
      definition: '用于声明 HTTP 缓存复用与重新验证规则的响应头。',
      example: 'Cache-Control: max-age=3600',
      confidence: 0.96,
    },
    mastery: { state: 'learning' },
    mentions: [{
      id: 'final-message-mention',
      sourceType: 'message',
      sourceId: anchorId,
      sessionId: rootId,
      excerpt: '声明缓存复用与重新验证规则。',
      sourceTitle: 'HTTP 缓存策略',
    }],
    relatedNotes: [],
    relatedResources: [],
  };
}
