import { expect, test } from '@playwright/test'
import { rateCurrent, seedWork, startReciting } from './helpers'

test.describe('导入 → 标记 → 整篇复习 → 评分 → 打卡', () => {
  test('一条完整闭环（复习单位是「篇」）', async ({ page }) => {
    await seedWork(page, {
      title: '论语·学而第一',
      dynasty: '先秦',
      author: '孔子及弟子',
      lines: [
        '子曰：学而时习之，不亦说乎？',
        '有朋自远方来，不亦乐乎？',
        '人不知而不愠，不亦君子乎？',
      ],
      skipLines: [2],
    })

    // 第 3 行被设成「不背」，所以这一篇只有 2 段要背；队列按篇算，只有 1 篇
    await page.goto('/review')
    const readout = page.locator('.panel').first()
    await expect(readout).toContainText('已完成 / 今日 DUE')
    await expect(readout).toContainText('今天需背 1 篇')
    await expect(readout).toContainText(/预计还需 \d+ 分钟/)

    // 长按进入背诵态：整篇默认熄灭
    await startReciting(page)
    await expect(page.getByText('整篇熄灭，先背一遍')).toBeVisible()

    // 提示下一段：一次亮一段
    await page.getByRole('button', { name: '提示下一段' }).click()
    await expect(page.locator('.text-body').first()).toContainText('xué')
    await expect(page.getByText('还有 1 段未显示')).toBeVisible()

    // 显示全文：只显示要背的 2 段（第 3 段不出现）
    await page.getByRole('button', { name: '显示全文' }).click()
    await expect(page.locator('.text-body')).toHaveCount(2)
    await expect(page.locator('.text-body').nth(1)).toContainText('lái')

    // 全部隐藏回到熄灭态
    await page.getByRole('button', { name: '全部隐藏' }).click()
    await expect(page.getByText('整篇熄灭，先背一遍')).toBeVisible()
    await page.getByRole('button', { name: '提示下一段' }).click()
    await expect(page.locator('.text-body')).toHaveCount(1)

    // 整篇一次评分
    await rateCurrent(page, '流畅背诵')

    // 当日到期篇评完 → 自动打卡
    await expect(page.getByText('今日任务已完成')).toBeVisible()
    await expect(page.getByText('已打卡 · CHECKED IN')).toBeVisible()

    // 统计口径按篇：今天完成 1 篇
    await page.goto('/review')
    await expect(page.locator('.panel').first()).toContainText('已完成 1 篇')
  })

  test('跳过在多篇之间轮换，且不改排期', async ({ page }) => {
    await seedWork(page, { title: '论语·学而第一', lines: ['子曰：学而时习之，不亦说乎？'] })
    await seedWork(page, { title: '道德经·第一章', lines: ['道可道，非常道。'] })

    await page.goto('/review')
    await startReciting(page)

    const head = page.locator('section .panel').first()
    await expect(head).toContainText('论语·学而第一')
    await page.getByRole('button', { name: '跳过' }).click()
    await expect(head).toContainText('道德经·第一章')

    // 跳过之后仍是 2 篇待背
    await expect(page.locator('.panel').first()).toContainText('今天需背 2 篇')
  })
})

test.describe('篇目页', () => {
  test('单卡 + 前后翻篇 + 深链', async ({ page }) => {
    await seedWork(page, { title: '论语·学而第一', lines: ['子曰：学而时习之，不亦说乎？'] })
    await seedWork(page, { title: '岳阳楼记', dynasty: '宋', author: '范仲淹', lines: ['先天下之忧而忧。'] })

    await page.goto('/library')
    const card = page.locator('article').first()
    await expect(card).toContainText('第 01 / 共 02 篇')

    await page.getByRole('button', { name: '下一篇' }).click()
    await expect(page.locator('article').first()).toContainText('岳阳楼记')
    await expect(page).toHaveURL(/work=/)

    const url = page.url()
    await page.goto(url)
    await expect(page.locator('article').first()).toContainText('第 02 / 共 02 篇')

    await page.getByRole('button', { name: '篇目一览' }).click()
    await page.locator('button', { hasText: '论语·学而第一' }).first().click()
    await expect(page.locator('article').first()).toContainText('第 01 / 共 02 篇')
  })

  test('段落行的常态操作是四个键，低频操作在编辑面板里', async ({ page }) => {
    await seedWork(page, { title: '陋室铭', lines: ['山不在高，有仙则名。'] })
    await page.goto('/library')
    const row = page.locator('li', { hasText: '山不在高' }).first()
    await expect(row.getByRole('button', { name: '编辑' })).toBeVisible()
    await expect(row.getByRole('button', { name: '上传录音' })).toBeVisible()
    await expect(row.getByRole('button', { name: '不背' })).toBeVisible()
    await expect(row.getByRole('button', { name: '删除' })).toHaveCount(0)

    await row.getByRole('button', { name: '编辑' }).click()
    await expect(page.getByRole('button', { name: '删除该段' })).toBeVisible()
  })
})

test.describe('设置页', () => {
  test('导视带：右列是当前值，展开后能改，改完留下', async ({ page }) => {
    await page.goto('/settings')
    const fontBand = page.locator('div', { hasText: '正文字号' }).first()
    await expect(fontBand).toContainText('1.00×')

    await page.getByRole('button', { name: /正文字号/ }).click()
    const slider = page.locator('input[type="range"]').first()
    await slider.fill('1.5')
    await expect(page.locator('div', { hasText: '正文字号' }).first()).toContainText('1.50×')

    const pinyinLamp = page.getByRole('button', { name: /篇目页显示拼音/ })
    await expect(pinyinLamp).toContainText('OFF')
    await pinyinLamp.click()
    await expect(pinyinLamp).toContainText('ON')

    await page.reload()
    await expect(page.locator('div', { hasText: '正文字号' }).first()).toContainText('1.50×')
    await expect(page.getByRole('button', { name: /篇目页显示拼音/ })).toContainText('ON')
  })
})
