import path from 'node:path';
import { defineConfig } from '@playwright/test';

const projectRoot = path.resolve(__dirname, '..');
const port = process.env.MENTOR_E2E_PORT ?? '3100';
const baseURL = process.env.MENTOR_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: path.join(projectRoot, 'tests/e2e'),
  outputDir: path.join(projectRoot, 'data/playwright-results'),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-1440x900', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-1024x768', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'mobile-390x844', use: { viewport: { width: 390, height: 844 } } },
    { name: 'compact-360x800', use: { viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    cwd: projectRoot,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
