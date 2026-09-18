import { expect, test } from '@playwright/test'
import { seedWork } from './helpers'

const FIXTURE = 'e2e/fixtures/three-segments.wav'

test.describe('整篇录音导入 + 按停顿切分', () => {
  test('三段落录音切成 3 段，写入后每段都有自己的区间', async ({ page }) => {
    await seedWork(page, {
      title: '三段落测试',
      lines: ['第一段的文字。', '第二段的文字。', '第三段的文字。'],
    })

    // 篇目页展开这一篇（单卡默认展开），导入整篇录音
    await page.getByLabel('导入整篇录音').setInputFiles(FIXTURE)

    // 切分界面：三段对三段，直接可以写入
    await expect(page.getByText('已切 3 段 / 需要 3 段')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('✓ 可以写入')).toBeVisible()
    await page.getByRole('button', { name: '写入' }).click()
    await expect(page.getByText(/已导入整篇录音，切成 3 段/)).toBeVisible({ timeout: 10_000 })

    // 数据库里每段都挂上了同一个音频，并各自有区间
    const clips = await page.evaluate(async () => {
      const open = indexedDB.open('guoxue-recitation')
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const all = (store: string) =>
        new Promise<Array<Record<string, unknown>>>((resolve) => {
          const req = db.transaction(store, 'readonly').objectStore(store).getAll()
          req.onsuccess = () => resolve(req.result as Array<Record<string, unknown>>)
          req.onerror = () => resolve([])
        })
      const passages = await all('passages')
      const audios = await all('audios')
      return {
        passageCount: passages.length,
        withAudio: passages.filter((p) => p.audioId).length,
        ranges: passages
          .map((p) => [p.audioStartMs, p.audioEndMs])
          .sort((a, b) => Number(a[0]) - Number(b[0])),
        audioRows: audios.length,
        workLevel: audios.filter((a) => a.passageId === null).length,
      }
    })
    expect(clips.passageCount).toBe(3)
    expect(clips.withAudio).toBe(3)
    expect(clips.audioRows).toBe(1) // 整篇只存一个文件
    expect(clips.workLevel).toBe(1) // 而且是篇级录音
    // 第一段从 0 开始，三段首尾相接
    expect(Number(clips.ranges[0][0])).toBeLessThan(200)
    expect(Number(clips.ranges[2][1])).toBeGreaterThan(7000)

    // 播放列表：三首都能播（都有区间）
    await page.goto('/player')
    await page.getByRole('button', { name: /三段落测试/ }).click()
    await expect(page.locator('li button:not([disabled])')).toHaveCount(3)
    await expect(page.locator('li', { hasText: '有录音' })).toHaveCount(3)
  })

  test('停顿时长不足阈值时不会乱切，且界面会提示还差几段', async ({ page }) => {
    await seedWork(page, {
      title: '需要补切点',
      lines: ['一。', '二。', '三。'],
    })

    await page.getByLabel('导入整篇录音').setInputFiles(FIXTURE)
    await expect(page.getByText('已切 3 段 / 需要 3 段')).toBeVisible({ timeout: 20_000 })

    // 把阈值提到 3 秒：测试音频的停顿只有 2.5 秒，于是切不出来 → 提示补切点
    await page.getByRole('button', { name: '停 3 秒' }).click()
    await expect(page.getByText('已切 1 段 / 需要 3 段')).toBeVisible()
    await expect(page.getByText('补几个切点')).toBeVisible()
    await expect(page.getByRole('button', { name: '写入' })).toBeDisabled()

    // 点波形两次补上切点后可以写入
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()
    if (!box) return
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2)
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height / 2)
    await expect(page.getByText('已切 3 段 / 需要 3 段')).toBeVisible()
    await expect(page.getByRole('button', { name: '写入' })).toBeEnabled()
  })
})
