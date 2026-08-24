import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '00-baseline';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const routes = [
  { name: 'today', path: '/today' },
  { name: 'chat', path: '/' },
  { name: 'notes', path: '/notes' },
  { name: 'resources', path: '/resources' },
  { name: 'interview', path: '/interview' },
  { name: 'review', path: '/review' },
  { name: 'analytics', path: '/analytics' },
  { name: 'whiteboard', path: '/whiteboard' },
];

test('采集八个核心页面的视觉基线', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name;
  const comparisonState = phase === '00-baseline' ? 'before' : 'after';
  const routeAudits: Array<Record<string, unknown>> = [];

  await fs.mkdir(captureRoot, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const route of routes) {
    const consoleErrors: string[] = [];
    const onConsole = (message: { type(): string; text(): string }) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    };
    page.on('console', onConsole);

    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `${route.path} 应成功响应`).toBeTruthy();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('body')).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const width = root.clientWidth;
      const visibleElements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
        });

      const describe = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className.toString().slice(0, 160),
          text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          width: Math.round(bounds.width),
        };
      };

      const outsideViewport = visibleElements
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < -1 || bounds.right > width + 1;
        })
        .slice(0, 30)
        .map(describe);

      const clippedContent = visibleElements
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .slice(0, 30)
        .map(describe);

      return {
        viewportWidth: width,
        documentWidth: root.scrollWidth,
        horizontalOverflow: root.scrollWidth > width + 1,
        outsideViewport,
        clippedContent,
        focusableCount: document.querySelectorAll(
          'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ).length,
      };
    });

    const screenshotName = `${phase}-${route.name}-default-${viewport}-${comparisonState}.png`;
    await page.screenshot({
      path: path.join(captureRoot, screenshotName),
      animations: 'disabled',
    });

    routeAudits.push({
      route: route.path,
      screenshot: screenshotName,
      title: await page.title(),
      consoleErrors,
      ...layout,
    });
    page.off('console', onConsole);
  }

  await fs.writeFile(
    path.join(captureRoot, `${phase}-${viewport}-audit.json`),
    `${JSON.stringify(routeAudits, null, 2)}\n`,
    'utf8',
  );
});
