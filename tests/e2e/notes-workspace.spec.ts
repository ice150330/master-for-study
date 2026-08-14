import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '09-notes-workspace';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('笔记工作区支持主从阅读、编辑、版本和失效来源', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 9 以桌面主从布局为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.route('**/api/notes', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        note: {
          id: body.id,
          sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: body.title,
          content: {},
          aiSnapshot: { source: 'ai' },
          userContent: { markdown: body.markdown },
          tags: body.tags,
          version: 2,
          markdown: body.markdown,
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-15T01:00:00.000Z',
          versions: [
            {
              id: 'version-user',
              version: 2,
              origin: 'user',
              title: body.title,
              markdown: body.markdown,
              tags: body.tags,
              createdAt: '2026-08-15T01:00:00.000Z',
            },
            {
              id: 'version-ai',
              version: 1,
              origin: 'ai',
              title: 'HTTP 缓存策略笔记',
              markdown: '# HTTP 缓存策略\n\nAI 初始内容',
              tags: ['HTTP'],
              createdAt: '2026-08-15T00:00:00.000Z',
            },
          ],
          sources: [
            {
              id: 'source-valid',
              sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              startMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              endMessageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              valid: true,
              sessionTitle: 'HTTP 缓存策略',
            },
          ],
        },
      },
    });
  });

  await page.goto('/dev/notes', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'HTTP 缓存策略笔记' })).toBeVisible();
  await expect(page.getByRole('link', { name: /来源：HTTP 缓存策略/ })).toHaveAttribute(
    'href',
    /session=aaaaaaaa.*message=bbbbbbbb/,
  );
  await expect(page.getByRole('link', { name: '生成复习卡' })).toBeVisible();
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByRole('button', { name: '已复制', exact: true })).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-reader-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '编辑笔记' }).click();
  await page.getByRole('textbox', { name: '笔记标题' }).fill('HTTP 缓存策略（我的版本）');
  await page.getByRole('textbox', { name: 'Markdown 正文' }).fill('# HTTP 缓存策略\n\n用户补充了协商缓存。');
  await page.getByRole('textbox', { name: '笔记标签' }).fill('HTTP, 缓存');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-editing-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: /保存版本/ }).click();
  await expect(page.getByText('版本 2 · AI 快照已保留')).toBeVisible();

  await page.getByRole('button', { name: '查看版本' }).click();
  await expect(page.getByText('AI 原始快照', { exact: true })).toBeVisible();
  await expect(page.getByText('用户编辑')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-versions-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /已失效来源示例/ }).click();
  await expect(page.getByText('来源已失效')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-invalid-source-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.goto('/dev/notes/empty', { waitUntil: 'networkidle' });
  await expect(page.getByText('选择会话生成第一篇笔记')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-empty-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
});
