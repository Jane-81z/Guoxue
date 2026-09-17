/** 开发用：跑一遍评分闭环，直接读 IndexedDB 里的当日统计，确认打卡到底写没写 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/import`)
await page.fill('#work-title', '打卡探针')
await page.fill('#raw-text', '道可道，非常道。\n名可名，非常名。')
await page.getByRole('button', { name: /确认导入/ }).click()
await page.waitForURL(/\/library/)

await page.goto(`${base}/review`)
await page.locator('.holdkey').focus()
await page.keyboard.press('Enter')
await page.locator('.keypad', { hasText: '流畅背诵' }).click()
await page.waitForTimeout(400)
await page.locator('.keypad', { hasText: '略有卡顿' }).click()
await page.waitForTimeout(1500)

const dbState = await page.evaluate(async () => {
  const open = indexedDB.open('guoxue-recitation')
  const db = await new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  const all = (store) =>
    new Promise((resolve) => {
      if (!db.objectStoreNames.contains(store)) return resolve([])
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve([])
    })
  const stats = await all('dailyStats')
  const passages = await all('passages')
  return {
    stats,
    passages: passages.map((p) => ({
      text: p.text.slice(0, 10),
      isRecite: p.isRecite,
      dueAt: p.srs.dueAt,
      history: p.srs.history.length,
    })),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
  }
})

nodeReplOut(JSON.stringify({ dbState, errors }, null, 1))
await browser.close()

function nodeReplOut(value) {
  process.stdout.write(`${value}\n`)
}
