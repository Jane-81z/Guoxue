/** 开发用：截「段落录音面板」的图（390 竖屏），并回报面板里的关键读数 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5173'
const out = 'E:/codex/reading/.impeccable/review'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})
const context = await browser.newContext()
const page = await context.newPage()
await page.setViewportSize({ width: 390, height: 844 })

// 假麦克风：与端到端同一套做法，只为把界面走到「录音中」
await page.addInitScript(() => {
  class FakeMediaRecorder extends EventTarget {
    state = 'inactive'
    mimeType = 'audio/mp4'
    static isTypeSupported() {
      return true
    }
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      this.dispatchEvent(new Event('stop'))
    }
  }
  Object.defineProperty(window, 'MediaRecorder', { value: FakeMediaRecorder, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    configurable: true,
  })
})

await page.goto(`${base}/import`, { waitUntil: 'networkidle' })
await page.fill('#work-title', '逍遥游')
await page.fill('#work-dynasty', '先秦')
await page.fill('#work-author', '庄子')
await page.fill(
  '#raw-text',
  `${'北冥有鱼，其名为鲲。鲲之大，不知其几千里也。化而为鸟，其名为鹏。鹏之背，不知其几千里也。怒而飞，其翼若垂天之云。是鸟也，海运则将徙于南冥。南冥者，天池也。齐谐者，志怪者也。谐之言曰：鹏之徙于南冥也，水击三千里，抟扶摇而上者九万里，去以六月息者也。'.repeat(2)}\n是鸟也，海运则将徙于南冥。`,
)
await page.getByRole('button', { name: /确认导入/ }).click()
await page.waitForURL(/\/library/)

await page.getByRole('button', { name: '录音', exact: true }).first().click()
await page.getByRole('button', { name: '拼音 关' }).click()
await page.getByRole('button', { name: '开始录音' }).click()
await page.waitForTimeout(1400)
await page.screenshot({ path: `${out}/record-sheet-390.png` })

// 念长文时要往下滚：滚到底之后仪表还该钉在顶上
const stickyTop = await page.evaluate(() => {
  const scroller = document.querySelector('[role="dialog"] .overflow-y-auto')
  if (!scroller) return null
  scroller.scrollTop = scroller.scrollHeight
  return null
})
await page.waitForTimeout(150)
await page.screenshot({ path: `${out}/record-sheet-390-scrolled.png` })

const probe = await page.evaluate(() => {
  const sheet = document.querySelector('[role="dialog"]')
  if (!sheet) return { error: 'no dialog' }
  const timer = sheet.querySelector('[role="timer"]')
  const scroller = sheet.querySelector('.overflow-y-auto')
  const text = sheet.querySelector('.text-body-stage')
  const stage = text?.getBoundingClientRect()
  const footer = sheet.querySelector('footer')
  return {
    timer: timer?.textContent,
    timerTopAfterScroll: timer ? Math.round(timer.getBoundingClientRect().top) : null,
    scrolledBy: scroller ? Math.round(scroller.scrollTop) : 0,
    canScroll: scroller ? scroller.scrollHeight > scroller.clientHeight : false,
    textChars: text?.textContent?.length ?? 0,
    textFontSize: text ? getComputedStyle(text).fontSize : null,
    stageHeight: stage ? Math.round(stage.height) : 0,
    stageBottom: stage ? Math.round(stage.bottom) : 0,
    footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : null,
    rtCount: sheet.querySelectorAll('.ruby-text rt').length,
    overflowsX: document.documentElement.scrollWidth > window.innerWidth,
  }
})
console.log(JSON.stringify({ ...probe, stickyTop }, null, 2))
await browser.close()
