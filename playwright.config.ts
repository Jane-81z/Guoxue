import { defineConfig, devices } from '@playwright/test'

/**
 * 端到端回归：跑在真实 Chrome 上，视口就是这台 App 的主场景（390×844，iPhone 竖屏）。
 * 用系统已装的 Chrome（channel: 'chrome'），不额外下载 Playwright 浏览器。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // 端到端测试用的同步服务替身（行为与 Cloudflare Pages Function 一致）
      command: 'node scripts/dev/mock-sync-server.mjs 4190',
      url: 'http://localhost:4190/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // 端到端测试用的 GitHub Gist API 替身
      command: 'node scripts/dev/mock-github-server.mjs 4191',
      url: 'http://localhost:4191/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
