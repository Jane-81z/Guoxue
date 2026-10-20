import { expect, test, type Page } from '@playwright/test'
import { seedWork } from './helpers'

/** 造一段真的静音 WAV：播放器要拿它走完「播完 → 自动接下一段」的真实路径 */
function wavBuffer(seconds: number, sampleRate = 8000): Buffer {
  const frames = seconds * sampleRate
  const buffer = Buffer.alloc(44 + frames * 2)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + frames * 2, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(frames * 2, 40)
  return buffer
}

async function attachAudio(page: Page, index: number, name: string, seconds: number) {
  await page.setInputFiles(`input[aria-label="上传第 ${index} 段录音"]`, {
    name,
    mimeType: 'audio/wav',
    buffer: wavBuffer(seconds),
  })
}

test.describe('播放列表', () => {
  test('整篇连播一段接一段；跳下一段从该段开头起，不接上次进度', async ({ page }) => {
    await seedWork(page, {
      title: '庄子·逍遥游',
      lines: ['北冥有鱼，其名为鲲。', '化而为鸟，其名为鹏。'],
    })
    await page.goto('/library')
    // 第一段短（让它快点放完，好事看自动接续），第二段长（容得下「上次听到 6 秒」）
    await attachAudio(page, 1, 'seg1.wav', 3)
    await attachAudio(page, 2, 'seg2.wav', 14)
    await expect(page.getByText(/已添加录音/)).toBeVisible()

    await page.goto('/player')
    await page.getByRole('button', { name: /庄子·逍遥游/ }).first().click()
    await expect(page).toHaveURL(/\/player\//)
    const range = page.locator('input[type=range]')
    const modeKey = page.getByRole('button', { name: '循环模式' })
    await expect(modeKey).toHaveText('顺序')
    // 界面上没有多加的键：整篇连播就靠下面这个模式键
    await expect(page.getByRole('button', { name: '整篇连播' })).toHaveCount(0)

    // 先手动听第 2 段到 6 秒再暂停：这一步会把「第 2 段听到 6 秒」记进设置
    await page.locator('li button', { hasText: '化而为鸟' }).first().click()
    await expect(page.getByLabel('暂停')).toBeVisible()
    await page.waitForTimeout(6200)
    await page.getByLabel('暂停').click()
    const savedPosition = Number(await range.inputValue())
    expect(savedPosition).toBeGreaterThan(5)

    // 点「整篇」那个模式键：从第一段开头连着放整篇
    await modeKey.click()
    await expect(modeKey).toHaveText('整篇')
    await page.waitForTimeout(700)
    expect(Number(await range.inputValue())).toBeLessThan(1.5)

    // 第一段放完自动接第二段：应当从第二段的 0 秒起，而不是刚才那个 6 秒
    await expect(page.locator('p', { hasText: '第 2 段' })).toBeVisible({ timeout: 20_000 })
    const afterAdvance = Number(await range.inputValue())
    expect(afterAdvance).toBeLessThan(savedPosition - 2)
  })

  test('点列表里的一段会接着上次听的位置播', async ({ page }) => {
    await seedWork(page, { title: '论语·学而', lines: ['子曰：学而时习之。'] })
    await page.goto('/library')
    await attachAudio(page, 1, 'lunyu.wav', 14)
    await expect(page.getByText(/已添加录音/)).toBeVisible()

    await page.goto('/player')
    await page.getByRole('button', { name: /论语·学而/ }).first().click()
    const range = page.locator('input[type=range]')

    await page.locator('li button', { hasText: '子曰' }).first().click()
    await expect(page.getByLabel('暂停')).toBeVisible()
    await page.waitForTimeout(6200)
    await page.getByLabel('暂停').click()
    const savedPosition = Number(await range.inputValue())
    expect(savedPosition).toBeGreaterThan(5)

    // 换到别处再回来点这一段：接着上次的位置
    await page.goto('/player')
    await page.getByRole('button', { name: /论语·学而/ }).first().click()
    await page.locator('li button', { hasText: '子曰' }).first().click()
    await expect(page.getByLabel('暂停')).toBeVisible()
    await page.waitForTimeout(400)
    expect(Number(await range.inputValue())).toBeGreaterThan(savedPosition - 2)
  })

  test('播放时申请屏幕常亮，暂停后释放，继续播再申请', async ({ page }) => {
    await page.addInitScript(() => {
      const state = { requests: 0, releases: 0 }
      ;(window as unknown as { __wake: typeof state }).__wake = state
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            state.requests += 1
            return {
              release: async () => {
                state.releases += 1
              },
              addEventListener: () => undefined,
            }
          },
        },
      })
    })

    await seedWork(page, { title: '常亮测试', lines: ['学而时习之。'] })
    await page.goto('/library')
    await attachAudio(page, 1, 'wake.wav', 10)
    await expect(page.getByText(/已添加录音/)).toBeVisible()

    await page.goto('/player')
    await page.getByRole('button', { name: /常亮测试/ }).first().click()
    await page.locator('li button', { hasText: '学而时习之' }).first().click()

    const wake = () =>
      page.evaluate(() => (window as unknown as { __wake: { requests: number; releases: number } }).__wake)
    await expect.poll(async () => (await wake()).requests).toBeGreaterThan(0)

    await page.getByLabel('暂停').click()
    await expect.poll(async () => (await wake()).releases).toBeGreaterThan(0)

    await page.getByRole('button', { name: '播放', exact: true }).click()
    await expect.poll(async () => (await wake()).requests).toBeGreaterThan(1)
  })
})
