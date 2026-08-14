import fs from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '17-accessibility-layout';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const conceptId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test.beforeEach(async () => {
  await fs.mkdir(captureRoot, { recursive: true });
});

test('键盘可跳到主内容，弹层支持 Escape 并恢复焦点', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '键盘流程只需在主桌面视口执行一次');

  await page.goto('/dev/ui', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: '跳到主要内容' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-keyboard-skip-link-1440x900.png`),
    animations: 'disabled',
    caret: 'initial',
  });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('route-scroll-region')).toBeFocused();

  await page.goto('/', { waitUntil: 'networkidle' });
  const sessionTrigger = page.getByRole('button', { name: /会话列表/ });
  await sessionTrigger.click();
  await expect(page.getByRole('textbox', { name: '搜索会话' })).toBeFocused();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-session-picker-keyboard-1440x900.png`),
    animations: 'disabled',
    caret: 'initial',
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: '搜索会话' })).toBeHidden();
  await expect(sessionTrigger).toBeFocused();

  await page.route('**/api/concepts?*', async (route) => route.fulfill({ json: conceptFixture() }));
  await page.goto(`/?concept=${conceptId}`, { waitUntil: 'networkidle' });
  const conceptRail = page.getByRole('complementary', { name: '概念详情' });
  await expect(conceptRail).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-concept-rail-keyboard-1440x900.png`),
    animations: 'disabled',
    caret: 'initial',
  });
  await page.keyboard.press('Escape');
  await expect(conceptRail).toBeHidden();
});

test('关键工作区通过严重级无障碍扫描和目标尺寸检查', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '无障碍扫描按主桌面视口执行');
  const routes = [
    '/dev/ui',
    '/today',
    '/',
    '/dev/notes',
    '/resources',
    '/practice',
    '/interview',
    '/dev/review',
    '/dev/analytics',
    '/whiteboard',
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    const severe = result.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical');
    expect(severe, `${route} 不应存在严重级 axe 问题`).toEqual([]);

    const smallTargets = await findSmallButtonTargets(page);
    expect(smallTargets, `${route} 的非内联按钮目标不应小于 24px`).toEqual([]);
  }

  await page.goto('/dev/ui', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '切换为深色主题' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const darkResult = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  const darkSevere = darkResult.violations.filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical');
  expect(darkSevere, '深色主题不应存在严重级 axe 问题').toEqual([]);
});

test('桌面工作台在 1024 到 1600 与深色主题下不产生页面级横向滚动', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '本用例内部切换全部桌面验收宽度');
  await page.addInitScript(() => {
    (window as Window & { __mentorCls?: number }).__mentorCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (!entry.hadRecentInput) {
          (window as Window & { __mentorCls?: number }).__mentorCls! += entry.value ?? 0;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const routes = ['/dev/notes', '/practice', '/dev/review', '/dev/analytics', '/whiteboard'];
  const viewports = [
    { name: 'compact-desktop', width: 1024, height: 768 },
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide', width: 1600, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `${route} 在 ${viewport.width}px 不应出现页面级横向滚动`).toBeFalsy();
      const cls = await page.evaluate(() =>
        (window as Window & { __mentorCls?: number }).__mentorCls ?? 0);
      expect(cls, `${route} 在 ${viewport.width}px 的累计布局位移应低于 0.1`).toBeLessThan(0.1);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dev/analytics', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '切换为深色主题' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-analytics-dark-1440x900.png`),
    animations: 'disabled',
    caret: 'initial',
  });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/practice', { waitUntil: 'networkidle' });
  const runButton = page.getByRole('button', { name: '运行并验证' });
  const transitionDuration = await runButton.evaluate((element) =>
    Math.max(...getComputedStyle(element).transitionDuration.split(',').map((value) => Number.parseFloat(value))));
  expect(transitionDuration).toBeLessThanOrEqual(0.001);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-practice-reduced-motion-1024x768.png`),
    animations: 'disabled',
    caret: 'initial',
  });

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/dev/notes', { waitUntil: 'networkidle' });
  const longText = page.locator('article p').first();
  await longText.evaluate((element) => {
    element.textContent = `https://example.com/${'very-long-learning-context-segment-'.repeat(14)}`;
  });
  expect(await longText.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-notes-long-content-1600x900.png`),
    animations: 'disabled',
    caret: 'initial',
  });

  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/dev/ui', { waitUntil: 'networkidle' });
  const focusButton = page.getByTestId('focus-demo');
  await focusButton.focus();
  const focusOutline = await focusButton.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusOutline).not.toBe('none');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-forced-colors-focus-1600x900.png`),
    animations: 'disabled',
    caret: 'initial',
  });
});

test('390 宽度仅守住基础学习路径与页面级溢出底线', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390x844', '手机端不做专项精修，仅跑一档基础门禁');
  for (const route of ['/today', '/', '/dev/review']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${route} 在 390px 不应出现页面级横向滚动`).toBeFalsy();
    await expect(page.getByRole('navigation', { name: '移动端区域导航' })).toBeVisible();
  }
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-review-mobile-baseline-390x844.png`),
    animations: 'disabled',
    caret: 'initial',
  });
});

async function findSmallButtonTargets(page: Page) {
  return page.locator('button:visible').evaluateAll((buttons) => buttons.flatMap((button) => {
    const style = getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    if (style.display === 'inline' || (rect.width >= 24 && rect.height >= 24)) return [];
    return [{
      label: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40) || '(无名称)',
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }];
  }));
}

function conceptFixture() {
  return {
    concept: {
      id: conceptId,
      name: 'Cache-Control',
      canonicalName: 'Cache-Control',
      aliases: [],
      definition: '用于声明 HTTP 缓存复用与重新验证规则的响应头。',
      example: 'Cache-Control: max-age=3600',
      confidence: 0.96,
    },
    mastery: { state: 'learning' },
    mentions: [],
    relatedNotes: [],
    relatedResources: [],
  };
}
