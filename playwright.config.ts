import { defineConfig, devices } from '@playwright/test'

/** 本机别的项目可能正占着 5173，所以允许用 E2E_PORT 换一个口 */
const PORT = process.env.E2E_PORT ?? '5173'

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
  // 这套用例里会解码音频（整篇录音切分），机器忙时首屏懒加载偶尔偏慢
  expect: { timeout: 12_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
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
