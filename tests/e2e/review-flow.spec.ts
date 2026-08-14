import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '10-review-fsrs';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('主动回忆、评级、撤销与队列完成形成完整复习流', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 10 以桌面复习工作台为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  let logIndex = 0;
  await page.route('**/api/review', async (route) => {
    const body = route.request().postDataJSON() as { action: string; difficult?: boolean };
    if (body.action === 'undo') {
      await route.fulfill({ json: { undo: { restoredState: 'reviewing' } } });
      return;
    }
    if (body.action === 'flag') {
      await route.fulfill({ json: { card: { difficult: body.difficult } } });
      return;
    }
    logIndex += 1;
    await route.fulfill({
      json: { next: { logId: `review-log-${logIndex}`, intervalLabel: '3 天' } },
    });
  });

  await page.goto('/dev/review', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '缓存一致性' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看答案' })).toBeDisabled();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-question-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('textbox', { name: '主动回忆' }).fill('缓存与权威数据源需要在约定窗口内一致。');
  await page.getByRole('button', { name: '查看答案' }).click();
  await expect(page.getByText(/常见策略包括失效/)).toBeVisible();
  await expect(page.getByRole('button', { name: /记得/ })).toContainText('3 天');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-answer-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: /记得/ }).click();
  await expect(page.getByText(/缓存一致性.*已安排在 3 天后/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ETag' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-graded-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('heading', { name: '缓存一致性' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-undo-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '标为困难卡' }).click();
  await expect(page.getByRole('button', { name: '取消困难标记' })).toBeVisible();
  await page.getByRole('textbox', { name: '主动回忆' }).fill('数据保持一致');
  await page.getByRole('button', { name: '查看答案' }).click();
  await page.getByRole('button', { name: /记得/ }).click();

  await page.getByRole('button', { name: '口头回答' }).click();
  await page.getByRole('button', { name: '回答完成后点这里' }).click();
  await page.keyboard.press('Space');
  await expect(page.getByText(/HTTP 响应的实体标签/)).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.getByText('本轮复习完成')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-complete-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
});
