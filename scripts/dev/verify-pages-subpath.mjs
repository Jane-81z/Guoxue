/** 开发用：在「GitHub Pages 彩排环境」里验证子路径部署：首页、深链刷新、清单、SW、渲染 */
import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'http://localhost:4180/Guoxue/').replace(/\/$/, '') + '/'
const origin = new URL(base).origin
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

// 1. 首页
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const home = await page.evaluate(() => ({
  title: document.title,
  ground: getComputedStyle(document.body).backgroundColor,
  overflow: (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
  assetPrefix: document.querySelector('script[type=module]')?.getAttribute('src') ?? null,
  emptyState: document.body.innerText.includes('还没有可背的篇目'),
  manifestHref: document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? null,
}))

// 2. 深链刷新：直接打开 /Guoxue/review（GitHub Pages 会走 404.html 回落）
const deep = await page.goto(`${base}review`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const deepState = await page.evaluate(() => ({
  url: location.pathname,
  title: document.title,
  emptyState: document.body.innerText.includes('还没有可背的篇目'),
  navRendered: document.querySelectorAll('nav a').length,
}))

// 3. 清单与 Service Worker
const manifest = await page.evaluate(async () => {
  const res = await fetch('manifest.webmanifest')
  const json = await res.json()
  return { status: res.status, start_url: json.start_url, scope: json.scope }
})
const sw = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  return regs.map((r) => r.active?.scriptURL ?? r.installing?.scriptURL ?? 'pending')
})

await page.screenshot({ path: 'E:/codex/reading/.impeccable/review/pages-subpath.png' })
await browser.close()

process.stdout.write(
  `${JSON.stringify(
    {
      base,
      home,
      deepLinkReload: { httpStatus: deep?.status(), ...deepState },
      manifest,
      serviceWorker: sw,
      origin,
      consoleErrors: errors.slice(0, 5),
    },
    null,
    1,
  )}\n`,
)
