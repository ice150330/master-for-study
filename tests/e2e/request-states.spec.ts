import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '03-request-states';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 3 以桌面端交互状态为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('聊天 500 后保留问题并可重试成功', async ({ page }, testInfo) => {
  const sessions = [
    { id: 'session-a', parentId: null, title: 'HTTP 缓存', createdAt: '2026-08-14T08:00:00.000Z' },
  ];
  let chatAttempts = 0;

  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({ json: { sessions } });
  });
  await page.route('**/api/sessions/session-a', async (route) => {
    await route.fulfill({ json: { messages: [] } });
  });
  await page.route('**/api/terms', async (route) => {
    await route.fulfill({ json: { terms: [] } });
  });
  await page.route('**/api/chat', async (route) => {
    chatAttempts += 1;
    if (chatAttempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI 服务暂时不可用' }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/plain', body: '重试成功：缓存策略已恢复。' });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  const input = page.getByPlaceholder('输入问题，Enter 发送 / Shift+Enter 换行');
  await input.fill('解释 Cache-Control');
  await page.getByRole('button', { name: '发送' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'AI 服务暂时不可用' })).toBeVisible();
  await expect(input).toHaveValue('解释 Cache-Control');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-chat-500-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '重新发送' }).click();
  await expect(page.getByText('重试成功：缓存策略已恢复。')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'AI 服务暂时不可用' })).toHaveCount(0);
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-chat-retry-success-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
});

test('切换会话会中止旧流且旧响应不能覆盖新会话', async ({ page }) => {
  const sessions = [
    { id: 'session-a', parentId: null, title: '会话 A', createdAt: '2026-08-14T08:00:00.000Z' },
    { id: 'session-b', parentId: null, title: '会话 B', createdAt: '2026-08-14T09:00:00.000Z' },
  ];
  await page.route('**/api/sessions', async (route) => route.fulfill({ json: { sessions } }));
  await page.route('**/api/sessions/session-a', async (route) =>
    route.fulfill({ json: { messages: [{ role: 'assistant', content: 'A 的历史消息' }] } }),
  );
  await page.route('**/api/sessions/session-b', async (route) =>
    route.fulfill({ json: { messages: [{ role: 'assistant', content: 'B 的历史消息' }] } }),
  );
  await page.route('**/api/chat', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'A 的延迟回答' }).catch(() => undefined);
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('输入问题，Enter 发送 / Shift+Enter 换行').fill('开始一个慢请求');
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByRole('button', { name: '停止' })).toBeVisible();
  await page.getByRole('button', { name: /^打开会话树/ }).click();
  await page.getByRole('button', { name: '会话 B', exact: true }).click();

  await expect(page.getByText('B 的历史消息')).toBeVisible();
  await page.waitForTimeout(1_100);
  await expect(page.getByText('B 的历史消息')).toBeVisible();
  await expect(page.getByText('A 的延迟回答')).toHaveCount(0);
});

test('术语增强失败不会回滚已经完成的回答', async ({ page }) => {
  const sessions = [
    { id: 'session-a', parentId: null, title: '术语增强', createdAt: '2026-08-14T08:00:00.000Z' },
  ];
  await page.route('**/api/sessions', async (route) => route.fulfill({ json: { sessions } }));
  await page.route('**/api/sessions/session-a', async (route) =>
    route.fulfill({ json: { messages: [] } }),
  );
  await page.route('**/api/chat', async (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: '正文回答已经完成。' }),
  );
  await page.route('**/api/terms', async (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: '术语服务暂时不可用' }),
    }),
  );

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('输入问题，Enter 发送 / Shift+Enter 换行').fill('解释一个术语');
  await page.getByRole('button', { name: '发送' }).click();

  await expect(page.getByText('正文回答已经完成。')).toBeVisible();
  await expect(page.getByText('回答已完成，术语解释稍后补充')).toBeVisible();
});

test('资源保存失败后保留表单，重试成功后再清空', async ({ page }, testInfo) => {
  let attempts = 0;
  await page.route('**/api/resources/metadata', async (route) => {
    await route.fulfill({
      json: {
        metadata: {
          title: 'MDN 缓存指南',
          canonicalUrl: 'https://developer.mozilla.org/cache',
          siteName: 'MDN',
          author: null,
          description: 'HTTP 缓存学习资料。',
          faviconUrl: null,
          type: '文档',
        },
      },
    });
  });
  await page.route('**/api/resources', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '资源服务暂时不可用' }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        resource: {
          id: 'resource-e2e',
          workspaceId: 'workspace-e2e',
          termId: null,
          title: 'MDN 缓存指南',
          type: '文档',
          url: 'https://developer.mozilla.org/cache',
          canonicalUrl: 'https://developer.mozilla.org/cache',
          siteName: 'MDN',
          author: null,
          description: 'HTTP 缓存学习资料。',
          faviconUrl: null,
          status: '想读',
          progress: 0,
          tags: [],
          note: null,
          createdAt: '2026-08-14T10:00:00.000Z',
          updatedAt: '2026-08-14T10:00:00.000Z',
          concepts: [],
          highlights: [],
        },
        duplicate: false,
      }),
    });
  });

  await page.goto('/resources', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '添加资源' }).click();
  const url = page.getByRole('textbox', { name: '资源链接' });
  await url.fill('https://developer.mozilla.org/cache');
  await page.getByRole('button', { name: '读取信息' }).click();
  const title = page.getByLabel('标题');
  await expect(title).toHaveValue('MDN 缓存指南');
  await page.getByRole('button', { name: '加入收件箱' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '资源服务暂时不可用' })).toBeVisible();
  await expect(title).toHaveValue('MDN 缓存指南');
  await expect(url).toHaveValue('https://developer.mozilla.org/cache');
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-resource-500-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText('资源已加入收件箱')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: '添加资源' }).click();
  await expect(page.getByRole('textbox', { name: '资源链接' })).toHaveValue('');
});

test('复习提交失败后保留答案面并可恢复队列', async ({ page }, testInfo) => {
  let attempts = 0;
  await page.route('**/api/review', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '复习记录写入失败' }),
      });
      return;
    }
    await route.fulfill({ json: { next: { logId: 'review-log-success', intervalLabel: '3 天' } } });
  });

  await page.goto('/dev/request-states/review', { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: '主动回忆' }).fill('重复请求只产生一次结果');
  await page.getByRole('button', { name: '查看答案' }).click();
  await page.getByRole('button', { name: /记得/ }).click();

  await expect(page.getByRole('alert').filter({ hasText: '复习记录写入失败' })).toBeVisible();
  await expect(page.getByText('同一个操作重复执行多次')).toBeVisible();
  await page.screenshot({
    path: path.join(captureRoot, `${phase}-review-500-${testInfo.project.name}.png`),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '重新提交' }).click();
  await expect(page.getByText('本轮复习完成')).toBeVisible();
});
