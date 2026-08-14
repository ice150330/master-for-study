import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { analyticsFixture } from '../../src/app/dev/analytics/fixture';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '15-actionable-analytics';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('成长分析支持范围切换、日期钻取、类型筛选和可信空状态', async ({ page }, testInfo) => {
  test.skip(!['desktop-1440x900', 'tablet-1024x768'].includes(testInfo.project.name), '阶段 15 以桌面分析工作台为主');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.route('**/api/analytics?*', async (route) => {
    const url = new URL(route.request().url());
    const days = Number(url.searchParams.get('days')) === 30 ? 30 : 7;
    await route.fulfill({ json: { analytics: analyticsFixture('normal', days) } });
  });

  await page.goto('/dev/analytics', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '6 个概念已到复习时间' })).toBeVisible();
  await expect(page.getByText('72%')).toBeVisible();
  await expect(page.getByText('SQL 分组聚合')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-overview-${testInfo.project.name}.png`),
    animations: 'disabled',
    fullPage: true,
  });

  await page.getByRole('button', { name: '近 30 天' }).click();
  await expect(page.getByRole('button', { name: '近 30 天' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('activity-trend').getByRole('button')).toHaveCount(30);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-30-days-${testInfo.project.name}.png`),
    animations: 'disabled',
    fullPage: true,
  });

  await page.getByRole('button', { name: /2026-08-15：/ }).click();
  await expect(page.getByText('正在查看 2026-08-15')).toBeVisible();
  await page.getByRole('heading', { name: '证据流水' }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-day-drilldown-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '评测', exact: true }).click();
  await expect(page.getByText('筛出高分学员').last()).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-assessment-filter-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.goto('/dev/analytics/small', { waitUntil: 'networkidle' });
  await expect(page.getByText('不足以判断')).toHaveCount(3);
  await page.getByText('评测通过').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-small-sample-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.goto('/dev/analytics/empty', { waitUntil: 'networkidle' });
  await expect(page.getByText('这段时间还没有学习证据')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-new-workspace-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
});

test('真实成长分析投影可以从本机数据库渲染', async ({ page }, testInfo) => {
  test.skip(!['desktop-1440x900', 'tablet-1024x768'].includes(testInfo.project.name), '阶段 15 以桌面分析工作台为主');
  await page.goto('/analytics', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: '成长分析' })).toBeVisible();
  await expect(page.getByTestId('activity-trend')).toBeVisible();
  await expect(page.getByText('服务暂时不可用')).toHaveCount(0);
});
