import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '08-today-actions';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('今日行动页覆盖首次使用、正常队列和全部处理状态', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '今日页按桌面主视口验收');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.goto('/dev/today/first', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('mentor-today-later'));
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '从一个真实问题开始' })).toBeVisible();
  await expect(page.getByRole('link', { name: /开始对话/ })).toHaveAttribute('href', '/');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-first-use-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.goto('/dev/today', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '继续：HTTP 缓存策略' })).toBeVisible();
  await expect(page.getByText('来自最近一次 message_sent 事件')).toBeVisible();
  await expect(page.getByRole('link', { name: /继续学习/ })).toHaveAttribute(
    'href',
    /\?session=11111111/,
  );
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-normal-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  const laterButtons = page.getByRole('button', { name: /今天稍后处理/ });
  while ((await laterButtons.count()) > 0) await laterButtons.first().click();
  await expect(page.getByRole('heading', { name: '今天的行动已处理' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-completed-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '恢复稍后项目' }).click();
  await expect(page.getByRole('heading', { name: '继续：HTTP 缓存策略' })).toBeVisible();
});
