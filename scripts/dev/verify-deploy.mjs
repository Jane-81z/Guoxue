/**
 * 开发用：对线上部署做一次实测——静态资源、SPA 回落、PWA 清单与 Service Worker，
 * 再用无头 Chrome 真正加载一次，确认渲染与本地一致。
 * 用法：node scripts/dev/verify-deploy.mjs https://your-app.vercel.app
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'https://guoxue-six.vercel.app').replace(/\/$/, '')
/** 本机 vercel.app 的 DNS 被污染，走系统里的本地代理；传 "none" 可关闭 */
const proxy = process.argv[3] ?? 'http://127.0.0.1:7890'
const results = []

/** 静态资源用 curl 取，才能带上代理与响应头 */
function check(path, { text = false } = {}) {
  const headFile = join(tmpdir(), 'verify-deploy-head.txt')
  const bodyFile = join(tmpdir(), 'verify-deploy-body.bin')
  const args = ['-sS', '--max-time', '25', '-D', headFile, '-o', bodyFile]
  if (proxy !== 'none') args.push('-x', proxy)
  execFileSync('curl.exe', [...args, base + path], { encoding: 'utf8' })
  const head = readFileSync(headFile, 'utf8')
  const body = text ? readFileSync(bodyFile, 'utf8') : ''
  const status = Number(head.match(/^HTTP\/[\d.]+ (\d+)/m)?.[1] ?? 0)
  const type = head.match(/^content-type:\s*(.+)$/im)?.[1]?.trim() ?? ''
  const cache = head.match(/^cache-control:\s*(.+)$/im)?.[1]?.trim() ?? ''
  const bytes = statSync(bodyFile).size
  const row = { path, status, type, cache, bytes }
  results.push(row)
  return { status, type, cache, body }
}

const home = check('/', { text: true })
const spa = check('/review', { text: true })
const manifest = check('/manifest.webmanifest', { text: true })
await check('/sw.js')
await check('/pwa-512.png')
await check('/apple-touch-icon.png')
await check('/favicon.svg')

// 首页引用的 bundle 是否可取
const asset = home.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/)?.[0] ?? null
if (asset) await check(asset)

// 本地构建产物里的文件名，用来确认线上跑的就是最新提交
let localAsset = null
try {
  localAsset = readFileSync('dist/index.html', 'utf8').match(/\/assets\/[A-Za-z0-9_.-]+\.js/)?.[0] ?? null
} catch {
  localAsset = null
}

const manifestJson = manifest.body ? JSON.parse(manifest.body) : null
const spaIsHtml = spa.body.includes('<div id="root">')

// 真渲染
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  ...(proxy !== 'none' ? { proxy: { server: proxy } } : {}),
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(`${base}/review`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

const render = await page.evaluate(() => {
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker.controller !== null : null
  const link = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null
  return {
    title: document.title,
    ground: getComputedStyle(document.body).backgroundColor,
    overflow: (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
    emptyState: document.body.innerText.includes('还没有可背的篇目'),
    holdKey: document.querySelector('.holdkey')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    manifestHref: link,
    serviceWorkerControlled: sw,
    appleTouchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
  }
})

// 注册状态（首次访问时 controller 可能还是 null，等一下再看注册表）
const swRegistered = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false
  const regs = await navigator.serviceWorker.getRegistrations()
  return regs.length > 0
})

await page.screenshot({ path: 'E:/codex/reading/.impeccable/review/deployed-review.png' })
await browser.close()

process.stdout.write(
  `${JSON.stringify(
    {
      base,
      staticChecks: results,
      assetMatchesLocalBuild: asset && localAsset ? asset === localAsset : null,
      localAsset,
      liveAsset: asset,
      spaFallbackServesApp: spaIsHtml,
      manifest: manifestJson
        ? { name: manifestJson.name, short_name: manifestJson.short_name, icons: manifestJson.icons?.length }
        : null,
      render,
      serviceWorkerRegistered: swRegistered,
      consoleErrors: errors.slice(0, 5),
    },
    null,
    1,
  )}\n`,
)
