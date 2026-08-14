import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '01-foundations';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('基础组件具备完整视觉状态和键盘行为', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 1 以桌面视觉验收为主');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  const response = await page.goto('/dev/ui', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: '交互基础件' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-components-light-desktop-after.png`),
    fullPage: true,
    animations: 'disabled',
  });

  const main = page.locator('main');
  await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-components-content-states-desktop-after.png`),
    animations: 'disabled',
  });
  await main.evaluate((element) => element.scrollTo({ top: 0 }));

  const focusButton = page.getByTestId('focus-demo');
  await focusButton.focus();
  const outlineStyle = await focusButton.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outlineStyle).not.toBe('none');
  await expect(page.getByRole('tooltip', { name: '搜索知识' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-components-tooltip-focus-desktop-after.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '打开对话框' }).click();
  await expect(page.getByRole('dialog', { name: '保存为学习目标' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-components-dialog-desktop-after.png`),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: '查看学习上下文' }).click();
  await expect(page.getByText('数据库索引')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '更多操作' }).click();
  await expect(page.getByRole('menuitem', { name: '归档' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '显示通知' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已加入复习队列' })).toBeVisible();

  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-components-dark-desktop-after.png`),
    fullPage: true,
    animations: 'disabled',
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transitionDuration = await focusButton.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(transitionDuration).toBeLessThanOrEqual(0.001);
});
