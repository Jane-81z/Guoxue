/** 开发用：一轮批量截图（390 与 1440），并回报每页的溢出与关键读数 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const out = 'E:/codex/reading/.impeccable/review'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})

const errors = []
// 同一个 context：IndexedDB 随 context 走，桌面页必须能看到手机页导入的数据
const context = await browser.newContext()
const phone = await context.newPage()
await phone.setViewportSize({ width: 390, height: 844 })
phone.on('pageerror', (e) => errors.push(`phone: ${e}`))
phone.on('console', (m) => m.type() === 'error' && errors.push(`phone console: ${m.text()}`))

// 种入示例数据（每次跑用全新 profile，所以这里导入）
async function seed(title, dynasty, author, raw) {
  await phone.goto(`${base}/import`, { waitUntil: 'networkidle' })
  await phone.fill('#work-title', title)
  await phone.fill('#work-dynasty', dynasty)
  await phone.fill('#work-author', author)
  await phone.fill('#raw-text', raw)
  await phone.getByRole('button', { name: /确认导入/ }).click()
  await phone.waitForURL(/\/library/, { timeout: 15000 })
}

await seed(
  '论语·学而第一',
  '先秦',
  '孔子及弟子',
  '子曰：学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？曾子曰：吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？\n有朋自远方来，不亦乐乎？\n人不知而不愠，不亦君子乎？',
)
await seed('道德经·第一章', '先秦', '老子', '道可道，非常道。\n名可名，非常名。')
await seed('岳阳楼记', '宋', '范仲淹', '先天下之忧而忧，后天下之乐而乐。')

async function probe(page) {
  return page.evaluate(() => {
    const doc = document.scrollingElement
    return {
      path: location.pathname,
      title: document.title,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      horizontalOverflow: doc ? doc.scrollWidth - window.innerWidth : null,
      docHeight: doc?.scrollHeight ?? null,
      readouts: [...document.querySelectorAll('.readout')].slice(0, 6).map((el) =>
        el.textContent?.trim(),
      ),
      panels: document.querySelectorAll('.panel').length,
      cells: document.querySelectorAll('.cellrow').length,
      meta: [...document.querySelectorAll('.meta, .chip')]
        .slice(0, 4)
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    }
  })
}

const report = {}

for (const [name, path] of [
  ['mobile', '/review'],
  ['library-mobile', '/library'],
  ['player-mobile', '/player'],
  ['settings-mobile', '/settings'],
  ['import-mobile', '/import'],
]) {
  await phone.goto(`${base}${path}`, { waitUntil: 'networkidle' })
  await phone.waitForTimeout(500)
  report[name] = await probe(phone)
  await phone.screenshot({ path: `${out}/${name}.png`, fullPage: name === 'settings-mobile' })
}

// 桌面宽度：首页第一屏 + 整页
const desktop = await context.newPage()
await desktop.setViewportSize({ width: 1440, height: 900 })
desktop.on('pageerror', (e) => errors.push(`desktop: ${e}`))
await desktop.goto(`${base}/review`, { waitUntil: 'networkidle' })
await desktop.waitForTimeout(500)
report.desktop = await probe(desktop)
await desktop.screenshot({ path: `${out}/desktop.png`, fullPage: true })
await desktop.goto(`${base}/library`, { waitUntil: 'networkidle' })
await desktop.waitForTimeout(400)
report['library-desktop'] = await probe(desktop)
await desktop.screenshot({ path: `${out}/library-desktop.png`, fullPage: true })

process.stdout.write(`${JSON.stringify({ report, errors: errors.slice(0, 6) }, null, 1)}\n`)
await browser.close()
