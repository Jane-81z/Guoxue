import { expect, test, type Page } from '@playwright/test'
import { seedWork } from './helpers'

const SYNC_ENDPOINT = 'http://localhost:4190/api/sync'

/** 在设置页里配置云同步：同一个码 = 同一份数据 */
async function configureSync(page: Page, code: string, endpoint = SYNC_ENDPOINT) {
  await page.goto('/settings')
  // 默认走 GitHub Gist，这一组用例验证 Cloudflare 那条路
  await page.getByRole('button', { name: 'Cloudflare' }).click()
  await page.getByRole('button', { name: /^同步码/ }).click()
  await page.getByLabel('同步服务地址').fill(endpoint)
  await page.getByLabel('同步码').fill(code)
  await expect(page.getByRole('button', { name: '同步', exact: true })).toBeVisible()
}

async function syncNow(page: Page) {
  await page.goto('/settings')
  await page.getByRole('button', { name: '同步', exact: true }).click()
  await expect(page.getByText(/已同步（Cloudflare）：拉取/)).toBeVisible({ timeout: 10_000 })
}

/** 按标题跳到某一篇（不依赖卡片顺序） */
async function openWork(page: Page, title: string) {
  await page.goto('/library')
  await page.getByRole('button', { name: '篇目一览' }).click()
  await page.locator('ul li > button', { hasText: title }).first().click()
}

test.describe('云同步（同步码，无账号）', () => {
  test('电脑导入 → 手机输入同一个码 → 内容出现；两端的改动与删除都会合并', async ({
    browser,
  }) => {
    const code = 'E2ETESTCODE1'
    const desktopCtx = await browser.newContext()
    const phoneCtx = await browser.newContext()
    const desktop = await desktopCtx.newPage()
    const phone = await phoneCtx.newPage()

    // 电脑：导入一篇 → 设同步码 → 同步
    await seedWork(desktop, {
      title: '论语·学而第一',
      lines: ['子曰：学而时习之，不亦说乎？', '有朋自远方来，不亦乐乎？'],
    })
    await configureSync(desktop, code)
    await syncNow(desktop)

    // 手机：全新设备，输入同一个码 → 同步 → 篇目出现
    await phone.goto('/settings')
    await configureSync(phone, code)
    await syncNow(phone)
    await phone.goto('/library')
    await expect(phone.locator('article').first()).toContainText('论语·学而第一')
    await expect(phone.locator('article').first()).toContainText('0/2')

    // 手机：自己也导入一篇 → 同步
    await seedWork(phone, { title: '道德经·第一章', lines: ['道可道，非常道。'] })
    await syncNow(phone)

    // 电脑：同步 → 拿到手机新增的那一篇，且原来那篇还在
    await syncNow(desktop)
    await desktop.goto('/library')
    await desktop.getByRole('button', { name: '篇目一览' }).click()
    // 断言限定在抽屉的行里：当前卡片也会显示同样的标题
    await expect(desktop.locator('ul li > button', { hasText: '道德经·第一章' })).toBeVisible()
    await expect(desktop.locator('ul li > button', { hasText: '论语·学而第一' })).toBeVisible()
    await desktop.getByRole('button', { name: '关闭' }).click()

    // 电脑：删掉论语 → 同步；手机：同步 → 那一篇消失，道德经还在（墓碑生效）
    await openWork(desktop, '论语·学而第一')
    await desktop.getByRole('button', { name: '删除篇目' }).click()
    await desktop.getByRole('button', { name: '删除', exact: true }).click()
    await syncNow(desktop)
    await syncNow(phone)
    await phone.goto('/library')
    await expect(phone.locator('article').first()).toContainText('道德经·第一章')
    await phone.getByRole('button', { name: '篇目一览' }).click()
    await expect(phone.getByText('论语·学而第一')).toHaveCount(0)

    await desktopCtx.close()
    await phoneCtx.close()
  })

  test('没设同步码时点同步会提示先设码', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Cloudflare' }).click()
    await expect(page.getByRole('button', { name: '先设同步码' })).toBeVisible()
    await page.getByRole('button', { name: '先设同步码' }).click()
    await expect(page.getByText('请先设置同步码（至少 8 位，或点「生成随机码」）')).toBeVisible()
  })

  test('同步码与服务地址会写进本地设置，重载后仍在', async ({ page }) => {
    await configureSync(page, 'KEEPME12345')
    await page.reload()
    await page.getByRole('button', { name: /^同步码/ }).click()
    await expect(page.getByLabel('同步码')).toHaveValue('KEEP ME12 345')
    await expect(page.getByLabel('同步服务地址')).toHaveValue(SYNC_ENDPOINT)
  })
})
