import { expect, type Page } from '@playwright/test'

export interface SeedWork {
  title: string
  dynasty?: string
  author?: string
  /** 每行一段 */
  lines: string[]
  /** 第几行（从 0 起）设为「不用背」 */
  skipLines?: number[]
}

/** 走真实的导入流程建一篇：粘贴 → 预览 → 取消勾选 → 确认 */
export async function seedWork(page: Page, work: SeedWork): Promise<void> {
  await page.goto('/import')
  await page.fill('#work-title', work.title)
  if (work.dynasty) await page.fill('#work-dynasty', work.dynasty)
  if (work.author) await page.fill('#work-author', work.author)
  await page.fill('#raw-text', work.lines.join('\n'))

  for (const index of work.skipLines ?? []) {
    const toggle = page.locator('ul li button[aria-label="取消背诵"]').nth(index)
    await toggle.click()
  }

  await page.getByRole('button', { name: /确认导入/ }).click()
  await expect(page).toHaveURL(/\/library/)
  await expect(page.locator('article')).toContainText(work.title)
}

/** 首页从读数板进入背诵态（长按键的键盘等价动作） */
export async function startReciting(page: Page): Promise<void> {
  await page.locator('.holdkey').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.keypad')).toHaveCount(4)
}

export async function rateCurrent(page: Page, label: string): Promise<void> {
  await page.locator('.keypad', { hasText: label }).click()
}
