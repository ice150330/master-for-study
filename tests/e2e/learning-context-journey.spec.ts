import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '16-learning-context-journey';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const conceptId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const noteId = '11111111-1111-4111-8111-111111111111';
const source = `note:${noteId}`;
const query = `concept=${conceptId}&source=${encodeURIComponent(source)}`;

test('同一 Concept 跨模块保留来源、聚焦对象与浏览器历史', async ({ page }, testInfo) => {
  test.skip(!['desktop-1440x900', 'tablet-1024x768'].includes(testInfo.project.name), '阶段 16 以桌面上下文轨道为主');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.route('**/api/concepts?*', async (route) => {
    await route.fulfill({ json: conceptFixture() });
  });

  await page.goto(`/dev/notes?note=${noteId}&${query}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('learning-context-bar')).toContainText('Cache-Control');
  await expect(page.getByTestId('learning-context-bar')).toContainText('学习笔记');
  await expect(page.locator(`[data-context-focus="note:${noteId}"]`)).toBeFocused();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-01-note-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('link', { name: '模拟面试' }).click();
  await expect(page).toHaveURL(new RegExp(`/interview\\?.*concept=${conceptId}.*source=note`));
  await expect(page.getByTestId('learning-context-bar')).toContainText('模拟面试');
  await page.screenshot({ path: path.join(captureRoot, `${phase}-02-interview-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('link', { name: '成长分析' }).click();
  await expect(page).toHaveURL(new RegExp(`/analytics\\?.*concept=${conceptId}.*source=note`));
  await expect(page.getByTestId('learning-context-bar')).toContainText('成长分析');
  await page.screenshot({ path: path.join(captureRoot, `${phase}-03-analytics-${testInfo.project.name}.png`), animations: 'disabled' });

  const scrollRegion = page.getByTestId('route-scroll-region');
  await scrollRegion.evaluate((element) => { element.scrollTop = 560; });
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(400);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem(`mentor-scroll:${location.pathname}${location.search}`)))).toBeGreaterThan(400);
  await page.getByRole('link', { name: '模拟面试' }).click();
  await expect(page).toHaveURL(new RegExp('/interview\\?'));
  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(new RegExp('/analytics\\?'));
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(400);
  await page.screenshot({ path: path.join(captureRoot, `${phase}-04-history-restored-${testInfo.project.name}.png`), animations: 'disabled' });
  await page.goForward({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(new RegExp('/interview\\?'));

  await page.goto(`/dev/review?${query}&attempt=${encodeURIComponent('review:review-fixture-1')}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('learning-context-bar')).toContainText('复习记录');
  await expect(page.locator('[data-context-focus="review:review-fixture-1"]')).toBeFocused();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-05-review-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.goto(`/?${query}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Cache-Control' })).toBeVisible();
  await expect(page.getByTestId('learning-context-bar')).toContainText('对话学习');
  await page.screenshot({ path: path.join(captureRoot, `${phase}-06-chat-${testInfo.project.name}.png`), animations: 'disabled' });
});

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
      id: 'mention-note',
      sourceType: 'note',
      sourceId: noteId,
      sessionId: null,
      excerpt: '笔记中的缓存复用条件',
      sourceTitle: 'HTTP 缓存策略笔记',
    }],
    relatedNotes: [{ id: noteId, title: 'HTTP 缓存策略笔记', sessionId: null }],
    relatedResources: [],
  };
}
