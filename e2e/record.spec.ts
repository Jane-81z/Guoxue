import { expect, test, type Page } from '@playwright/test'
import { seedWork } from './helpers'

/**
 * 段落录音：测试环境没有麦克风，所以注入一个假麦克风 + 假 MediaRecorder。
 * 假录音器吐出来的是一段真的 1 秒 WAV（8kHz/16bit/单声道），
 * 后面的解码、时长、落库、播放全都走真实代码。
 */
async function installFakeMic(page: Page) {
  await page.addInitScript(() => {
    const sampleRate = 8000
    const frames = sampleRate
    const bytes = new Uint8Array(44 + frames * 2)
    const view = new DataView(bytes.buffer)
    const ascii = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
    }
    ascii(0, 'RIFF')
    view.setUint32(4, 36 + frames * 2, true)
    ascii(8, 'WAVE')
    ascii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    ascii(36, 'data')
    view.setUint32(40, frames * 2, true)

    class FakeMediaRecorder extends EventTarget {
      state = 'inactive'
      mimeType: string
      static isTypeSupported(type: string) {
        return type.startsWith('audio/mp4') || type.startsWith('audio/webm')
      }
      constructor(_stream: unknown, options?: { mimeType?: string }) {
        super()
        this.mimeType = options?.mimeType ?? 'audio/mp4'
      }
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        const blob = new Blob([bytes], { type: this.mimeType })
        this.dispatchEvent(new BlobEvent('dataavailable', { data: blob }))
        this.dispatchEvent(new Event('stop'))
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      value: FakeMediaRecorder,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
      configurable: true,
    })
  })
}

test.describe('段落录音', () => {
  test('点录音 → 录一段 → 用这一段 → 挂到该段上并能播放', async ({ page }) => {
    await installFakeMic(page)
    await seedWork(page, { title: '论语·学而', lines: ['子曰：学而时习之。', '有朋自远方来。'] })

    // 第一段的常态键里就是「录音」（不再叫上传录音）
    await page.getByRole('button', { name: '录音', exact: true }).first().click()
    await expect(page.getByRole('dialog')).toContainText('录音 · 第 1 段')
    await expect(page.getByRole('timer')).toHaveText('0:00')

    // 面板里要能看着原文念（默认不带拼音，可当场开）
    const sheet = page.getByRole('dialog').first()
    await expect(sheet).toContainText('对着这一段念')
    await expect(sheet).toContainText('子曰：学而时习之。')
    await expect(sheet.locator('.ruby-text rt')).toHaveCount(0)
    await sheet.getByRole('button', { name: '拼音 关' }).click()
    await expect(sheet.getByRole('button', { name: '拼音 开' })).toBeVisible()
    await expect(sheet.locator('.ruby-text rt').first()).toBeVisible()

    await page.getByRole('button', { name: '开始录音' }).click()
    await expect(page.getByRole('button', { name: '停止录音' })).toBeVisible()
    await expect(page.getByText('录音中请不要锁屏')).toBeVisible()

    await page.getByRole('button', { name: '停止录音' }).click()
    await expect(page.getByRole('button', { name: '用这一段' })).toBeVisible()
    await expect(page.getByLabel('录音试听')).toBeVisible()

    await page.getByRole('button', { name: '用这一段' }).click()
    await expect(page.getByText(/已添加录音/)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // 这一段的常态键从「录音」变成「重录」，并显示时长
    await expect(page.getByRole('button', { name: '重录' }).first()).toBeVisible()
    await expect(page.locator('article').first()).toContainText(/1 秒|0 秒/)

    // 播放页按段列出这首「歌」
    await page.goto('/player')
    await page.getByRole('button', { name: /论语·学而/ }).first().click()
    await expect(page.locator('ul li').first()).toContainText('子曰')
  })

  test('录音中途关闭会问一句，确认后不留录音', async ({ page }) => {
    await installFakeMic(page)
    await seedWork(page, { title: '道德经·第一章', lines: ['道可道，非常道。'] })

    await page.getByRole('button', { name: '录音', exact: true }).first().click()
    await page.getByRole('button', { name: '开始录音' }).click()
    await expect(page.getByRole('button', { name: '停止录音' })).toBeVisible()

    await page.getByRole('button', { name: '关闭' }).click()
    const confirm = page.getByRole('dialog', { name: '正在录音，确定放弃？' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: '放弃' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    // 这一段仍然没有录音：常态键还是「录音」
    await expect(page.getByRole('button', { name: '录音', exact: true }).first()).toBeVisible()
  })

  test('浏览器不支持录音时说清楚，并留一条选文件的路', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'MediaRecorder', {
        value: undefined,
        configurable: true,
        writable: true,
      })
    })
    await page.on('filechooser', () => {})
    await seedWork(page, { title: '庄子·逍遥游', lines: ['北冥有鱼。'] })

    await page.getByRole('button', { name: '录音', exact: true }).first().click()
    await expect(page.getByText('这台设备/浏览器现在录不了')).toBeVisible()
    await expect(page.getByText(/14\.5/)).toBeVisible()

    await page.getByRole('button', { name: '改用「选文件」' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
