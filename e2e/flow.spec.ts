import { expect, test } from '@playwright/test'
import { rateCurrent, seedWork, startReciting } from './helpers'

test.describe('导入 → 标记 → 复习评分 → 打卡', () => {
  test('一条完整闭环', async ({ page }) => {
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

    // 导入页把第 3 行标成「不用背」，所以这一篇要背 2 段
    await page.goto('/review')
    const readout = page.locator('.panel').first()
    await expect(readout).toContainText('DONE / DUE')
    // 读数板对辅助技术给出的完整句子
    await expect(readout).toContainText('今日需背 2 段')
    // 预计用时读数
    await expect(readout).toContainText('MIN')
    await expect(readout).toContainText(/预计还需 \d+ 分钟/)

    // 长按开始（键盘等价）：整块板转进背诵态
    await startReciting(page)
    await expect(page.getByRole('button', { name: /原文熄灭/ })).toBeVisible()

    // 点亮原文能拿到原文
    await page.getByRole('button', { name: /点亮原文/ }).click()
    // 原文以 ruby 呈现：汉字上方带注音，所以 DOM 文本里夹着拼音
    await expect(page.locator('.text-body ruby rt').first()).toHaveText('zǐ')
    await expect(page.locator('.text-body')).toContainText('xué')

    // 四档评分：两段都评完
    await rateCurrent(page, '流畅背诵')
    await rateCurrent(page, '略有卡顿')

    // 当日到期评完 → 自动打卡
    await expect(page.getByText('今日任务已完成')).toBeVisible()
    await expect(page.getByText('已打卡 · CHECKED IN')).toBeVisible()

    // 打卡写进了统计：热力图那一格有记录
    await page.goto('/review')
    await expect(page.locator('.panel').first()).toContainText('已完成 2 段')
  })

  test('跳过不影响排期，评分后才离队', async ({ page }) => {
    await seedWork(page, { title: '道德经·第一章', lines: ['道可道，非常道。', '名可名，非常名。'] })
    await page.goto('/review')
    await startReciting(page)

    await expect(page.getByText('第 1 段')).toBeVisible()
    await page.getByRole('button', { name: '跳过' }).click()
    await expect(page.getByText('第 2 段')).toBeVisible()

    // 跳过之后仍是 2 张待背
    await expect(page.locator('.panel').first()).toContainText('今日需背 2 段')
  })
})

test.describe('篇目页', () => {
  test('单卡 + 前后翻篇 + 深链', async ({ page }) => {
    await seedWork(page, { title: '论语·学而第一', lines: ['子曰：学而时习之，不亦说乎？'] })
    await seedWork(page, { title: '岳阳楼记', dynasty: '宋', author: '范仲淹', lines: ['先天下之忧而忧。'] })

    await page.goto('/library')
    const card = page.locator('article').first()
    await expect(card).toContainText('第 01 / 共 02 篇')

    // 翻到下一篇：标题变了，地址也记下了这一篇
    await page.getByRole('button', { name: '下一篇' }).click()
    await expect(page.locator('article').first()).toContainText('岳阳楼记')
    await expect(page).toHaveURL(/work=/)

    // 深链：直接打开这个地址就是这一篇
    const url = page.url()
    await page.goto(url)
    await expect(page.locator('article').first()).toContainText('岳阳楼记')
    await expect(page.locator('article').first()).toContainText('第 02 / 共 02 篇')

    // 「篇目」抽屉能跳到另一篇
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
    await expect(page.getByRole('button', { name: '重置该段进度' })).toBeVisible()
  })
})

test.describe('设置页', () => {
  test('导视带：右列是当前值，展开后能改，改完留下', async ({ page }) => {
    await page.goto('/settings')
    const fontBand = page.locator('div', { hasText: '正文字号' }).first()
    await expect(fontBand).toContainText('1.00×')

    // 展开这条带，把字号推到最大
    await page.getByRole('button', { name: /正文字号/ }).click()
    const slider = page.locator('input[type="range"]').first()
    await slider.fill('1.5')
    await expect(page.locator('div', { hasText: '正文字号' }).first()).toContainText('1.50×')

    // 状态灯键：开关切换会改标签
    const pinyinLamp = page.getByRole('button', { name: /篇目页显示拼音/ })
    await expect(pinyinLamp).toContainText('OFF')
    await pinyinLamp.click()
    await expect(pinyinLamp).toContainText('ON')

    // 重载后设置仍在（写进 IndexedDB）
    await page.reload()
    await expect(page.locator('div', { hasText: '正文字号' }).first()).toContainText('1.50×')
    await expect(page.getByRole('button', { name: /篇目页显示拼音/ })).toContainText('ON')
  })
})
