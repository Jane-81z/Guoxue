import { expect, test } from '@playwright/test'
import { seedWork, startReciting } from './helpers'

test.describe('版式不变量（用户点名的那几条）', () => {
  test('长按键贴着底栏，且比背诵条目矮', async ({ page }) => {
    await seedWork(page, {
      title: '论语·学而第一',
      lines: ['子曰：学而时习之，不亦说乎？', '有朋自远方来，不亦乐乎？'],
    })
    await page.goto('/review')

    const hold = await page.locator('.holdkey').boundingBox()
    const cell = await page.locator('.cellrow').first().boundingBox()
    const nav = await page.locator('nav').boundingBox()
    expect(hold && cell && nav).toBeTruthy()
    if (!hold || !cell || !nav) return

    // 比条目矮
    expect(hold.height).toBeLessThan(cell.height)
    // 紧挨底栏（允许 1–16px 的视觉缝）
    const gap = nav.y - (hold.y + hold.height)
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(16)
  })

  test('四把评分键钉在底栏上方且完整可见', async ({ page }) => {
    await seedWork(page, { title: '道德经·第一章', lines: ['道可道，非常道。'] })
    await page.goto('/review')
    await startReciting(page)

    const keys = page.locator('.keypad')
    await expect(keys).toHaveCount(4)
    const nav = await page.locator('nav').boundingBox()
    const boxes = await keys.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, height: r.height }
      }),
    )
    expect(nav).toBeTruthy()
    for (const box of boxes) {
      expect(box.bottom).toBeLessThanOrEqual((nav?.y ?? 0) + 1)
      expect(box.top).toBeGreaterThanOrEqual(0)
    }
    const lowest = Math.max(...boxes.map((b) => b.bottom))
    expect((nav?.y ?? 0) - lowest).toBeLessThanOrEqual(16)
  })

  test('长原文只保留一个滚动手势，滚到底不被键挡住', async ({ page }) => {
    const long = '子曰：学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？曾子曰：吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？'
    await seedWork(page, { title: '长段测试', lines: [long] })
    await page.goto('/review')
    await startReciting(page)
    await page.getByRole('button', { name: '提示下一段' }).click()

    // 原文框自己不是滚动容器
    const inner = await page.locator('.text-body').first().evaluate((el) => ({
      client: el.clientHeight,
      scroll: el.scrollHeight,
    }))
    expect(inner.scroll).toBeLessThanOrEqual(inner.client + 2)

    // 滚到底：最后一行必须在评分键上方
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const text = await page.locator('.text-body').first().boundingBox()
    const keypad = await page.locator('.keypad').first().boundingBox()
    expect(text && keypad).toBeTruthy()
    if (!text || !keypad) return
    expect(text.y + text.height).toBeLessThanOrEqual(keypad.y + 1)
  })

  test('390 与 1440 两种视口都不横向溢出', async ({ page }) => {
    await seedWork(page, { title: '岳阳楼记', lines: ['先天下之忧而忧，后天下之乐而乐。'] })
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      for (const path of ['/review', '/library', '/player', '/settings', '/import']) {
        await page.goto(path)
        const overflow = await page.evaluate(
          () => (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
        )
        expect(overflow, `${path} 在 ${width} 宽度下横向溢出 ${overflow}px`).toBeLessThanOrEqual(0)
      }
    }
  })
})
