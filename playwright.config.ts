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
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
