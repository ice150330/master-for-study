import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '02-shell';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const routes = [
  { name: 'today', path: '/today', title: '今日学习' },
  { name: 'chat', path: '/', title: '对话学习' },
  { name: 'analytics', path: '/analytics', title: '成长分析' },
  { name: 'whiteboard', path: '/whiteboard', title: '知识白板' },
];

test('应用壳在四个视口保持清晰导航和稳定布局', async ({ page }, testInfo) => {
  await fs.mkdir(captureRoot, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const isMobile = testInfo.project.name.startsWith('mobile-') || testInfo.project.name.startsWith('compact-');
  const isDesktop = testInfo.project.name.startsWith('desktop-');

  for (const route of routes) {
    const response = await page.goto(route.path, { waitUntil: 'networkidle' });
    expect(response?.ok(), `${route.path} 应成功响应`).toBeTruthy();
    if (route.path === '/') {
      // 会话页是特例：无 PageShell 书签页头（页头即会话卡头），以输入区确认就位
      await expect(page.getByPlaceholder('输入问题，Enter 发送 / Shift+Enter 换行')).toBeVisible();
    } else {
      await expect(page.getByTestId('page-context-title')).toHaveText(route.title);
    }

    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(documentOverflow, `${route.path} 不应产生页面级横向滚动`).toBeFalsy();

    if (isMobile) {
      await expect(page.getByRole('navigation', { name: '移动端区域导航' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden();
    } else {
      await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: '移动端区域导航' })).toBeHidden();
    }

    if (route.path === '/today' && isDesktop) {
      // 左缘胶带纸签：窄轨（纯图标收起 + 当前签全名并向外抽出），远窄于原 196px 文字侧栏
      const rail = page.getByRole('navigation', { name: '主导航' });
      const railWidth = await rail.evaluate((element) => Math.round(element.getBoundingClientRect().width));
      expect(railWidth).toBeGreaterThan(40);
      expect(railWidth).toBeLessThan(180);
    }

    await page.screenshot({
      path: path.join(
        captureRoot,
        `${phase}-${route.name}-default-${testInfo.project.name}-after.png`,
      ),
      animations: 'disabled',
    });
  }

  if (isDesktop) {
    await page.getByRole('button', { name: '搜索页面' }).click();
    const searchInput = page.getByPlaceholder('搜索页面');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('资源');
    await page.getByRole('button', { name: '资源库' }).click();
    await expect(page).toHaveURL(/\/resources$/);

    await page.getByRole('button', { name: '工作台设置' }).click();
    await expect(page.getByRole('dialog').getByText('工作台设置', { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(captureRoot, `${phase}-settings-open-${testInfo.project.name}-after.png`),
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '暖纸', exact: true }).click();
    // 主题真相源是 <html> 的 data-theme 属性（纸白无属性，暖纸 warm，夜墨 night）
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'warm');
    await page.getByRole('button', { name: '纸白', exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    await page.keyboard.press('Escape');
  }

  if (testInfo.project.name.startsWith('tablet-')) {
    // 键盘聚焦纸签轨任一签：整轨扇出页名（focus-within，替代原侧栏 Tooltip 断言）
    const todayLink = page.getByRole('link', { name: '今日学习', exact: true });
    await todayLink.focus();
    await expect(todayLink.locator('.rail-tape-label')).toBeVisible();
  }
});
