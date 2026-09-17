/**
 * 开发用：在真实站点上复现「点了确认导入没反应」。
 * 分别测：只粘文本不填篇名（按钮应为禁用）、两样都填（应能导入），并抓控制台报错与点击是否被遮挡。
 * 用法：node scripts/dev/probe-import.mjs https://jane-81z.github.io/Guoxue/
 */
import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '')
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const logs = []
page.on('pageerror', (e) => logs.push(`pageerror: ${e}`))
page.on('console', (m) => m.type() === 'error' && logs.push(`console: ${m.text()}`))

async function buttonState() {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('确认导入'))
    if (!btn) return { found: false }
    const r = btn.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const top = document.elementFromPoint(cx, cy)
    return {
      found: true,
      label: btn.textContent?.trim(),
      disabled: btn.disabled,
      opacity: getComputedStyle(btn).opacity,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) },
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
      topElementIsButton: top === btn || btn.contains(top),
      topElement: top ? `${top.tagName.toLowerCase()}.${(top.className || '').toString().slice(0, 40)}` : null,
    }
  })
}

const out = {}

// 场景 1：只粘文本，不填篇名
await page.goto(`${base}/import`, { waitUntil: 'networkidle' })
await page.fill('#raw-text', '道可道，非常道。\n名可名，非常名。')
await page.waitForTimeout(300)
out.onlyText = await buttonState()

// 场景 2：补上篇名
await page.fill('#work-title', '道德经·第一章')
await page.waitForTimeout(300)
out.withTitle = await buttonState()

// 点下去看结果
await page.getByRole('button', { name: /确认导入/ }).click()
await page.waitForTimeout(1500)
out.afterClick = {
  url: page.url(),
  toast: await page
    .locator('div')
    .filter({ hasText: /已导入|失败|不能为空/ })
    .first()
    .textContent()
    .catch(() => null),
  cardText: await page
    .locator('article')
    .first()
    .textContent()
    .catch(() => null),
}

out.db = await page.evaluate(async () => {
  const open = indexedDB.open('guoxue-recitation')
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result)
    open.onerror = () => rej(open.error)
  })
  const all = (store) =>
    new Promise((res) => {
      if (!db.objectStoreNames.contains(store)) return res([])
      const req = db.transaction(store, 'readonly').objectStore(store).getAll()
      req.onsuccess = () => res(req.result)
      req.onerror = () => res([])
    })
  return { works: (await all('works')).length, passages: (await all('passages')).length }
})

out.logs = logs.slice(0, 6)
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`)
await page.screenshot({ path: 'E:/codex/reading/.impeccable/review/probe-import.png' })
await browser.close()
