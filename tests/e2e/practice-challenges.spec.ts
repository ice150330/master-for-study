import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '11-practice-challenges';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('SQL 任务在真实 Worker 中完成查询、错误与副作用验证', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 11 以桌面三栏实践工作台为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  const attempts: Array<Record<string, unknown>> = [];
  await page.route('**/api/practice', async (route) => {
    attempts.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 201, json: { attempt: { id: `attempt-${attempts.length}` } } });
  });

  await page.goto('/practice', { waitUntil: 'networkidle' });
  await expect(page.getByText('筛出高分学员', { exact: true })).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'SQL 编辑器' });
  await expect(editor).toHaveValue(/SELECT name, score/);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-initial-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '查看下一条提示' }).click();
  await expect(page.getByText(/WHERE 过滤 score/)).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-hint-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await editor.fill('SELEC name FROM students;');
  await page.getByRole('button', { name: '运行并验证' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '语法错误' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-syntax-error-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await editor.fill('SELECT name, score FROM students WHERE score >= 80 ORDER BY score DESC;');
  await page.getByRole('button', { name: '运行并验证' }).click();
  await expect(page.getByText('任务完成', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Alice' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bob' })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-success-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.getByText('统计部门均分', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看解法' }).click();
  await expect(page.getByRole('dialog')).toContainText('GROUP BY department');
  await page.getByRole('button', { name: '放入编辑器' }).click();
  await page.getByRole('button', { name: '运行并验证' }).click();
  await expect(page.getByText('任务完成', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.getByText('标记需要辅导的学员', { exact: true })).toBeVisible();
  await editor.fill("UPDATE students SET status = 'needs_support' WHERE score < 70;");
  await page.getByRole('button', { name: '运行并验证' }).click();
  await expect(page.getByText('数据副作用、修改行数和最终状态均符合要求。')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Dave' })).toBeVisible();
  await expect(page.getByText('本组任务已完成')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-side-effect-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '重置' }).click();
  await editor.fill("SELECT name, status FROM students WHERE status = 'needs_support';");
  await page.getByRole('button', { name: '运行并验证' }).click();
  await expect(page.getByText('修改行数不符合任务', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Dave' })).toHaveCount(0);

  await expect.poll(() => attempts.length).toBe(5);
  expect(attempts[0]).toMatchObject({
    challengeId: 'sql-filter-sort',
    status: 'error',
    errorType: 'syntax',
    runCount: 1,
    hintCount: 1,
    skills: ['WHERE', 'ORDER BY'],
  });
  expect(attempts[1]).toMatchObject({ challengeId: 'sql-filter-sort', status: 'success', runCount: 2 });
  expect(attempts[3]).toMatchObject({ challengeId: 'sql-update-risk', status: 'success', runCount: 1 });
  expect(attempts[4]).toMatchObject({
    challengeId: 'sql-update-risk',
    status: 'error',
    errorType: 'validation',
    runCount: 2,
  });
});
