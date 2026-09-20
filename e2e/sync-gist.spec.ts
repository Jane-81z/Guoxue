import { expect, test, type Page } from '@playwright/test'
import { seedWork } from './helpers'

const GITHUB_API = 'http://localhost:4191'
const TOKEN = 'ghp_e2e_test_token'

/** 两台设备用同一个令牌对上同一份 Gist：不需要复制任何 id */
async function configureGistSync(page: Page, token = TOKEN) {
  await page.goto('/settings')
  await page.getByRole('button', { name: /GitHub 令牌/ }).click()
  await page.getByLabel('GitHub API 地址').fill(GITHUB_API)
  await page.getByLabel('GitHub 令牌').fill(token)
  await expect(page.getByRole('button', { name: '同步', exact: true })).toBeVisible()
}

async function syncNow(page: Page, expectLabel: 'Gist' | '新建 Gist') {
  await page.goto('/settings')
  await page.getByRole('button', { name: '同步', exact: true }).click()
  await expect(page.getByText(new RegExp(`已同步（${expectLabel}）`))).toBeVisible({
    timeout: 10_000,
  })
}

/** 按标题跳到某一篇（不依赖卡片顺序） */
async function openWork(page: Page, title: string) {
  await page.goto('/library')
  await page.getByRole('button', { name: '篇目一览' }).click()
  await page.locator('ul li > button', { hasText: title }).first().click()
}

test.describe('云同步 · GitHub Gist', () => {
  test('第一台建设云端，第二台只贴同一个令牌就能拿到全部内容；改动与删除双向传播', async ({
    browser,
  }) => {
    const desktopCtx = await browser.newContext()
    const phoneCtx = await browser.newContext()
    const desktop = await desktopCtx.newPage()
    const phone = await phoneCtx.newPage()

    // 电脑：导入一篇 → 贴令牌 → 同步（首次会新建 Gist）
    await seedWork(desktop, {
      title: '论语·学而第一',
      lines: ['子曰：学而时习之，不亦说乎？', '有朋自远方来，不亦乐乎？'],
    })
    await configureGistSync(desktop)
    await syncNow(desktop, '新建 Gist')
    // Gist id 已经写进设置
    await desktop.getByRole('button', { name: /GitHub 令牌/ }).click()
    await expect(desktop.getByLabel('GitHub 令牌')).toHaveValue(TOKEN)

    // 手机：全新设备，只贴同一个令牌 → 同步 → 自动找到那个 Gist → 内容出现
    await configureGistSync(phone)
    await syncNow(phone, 'Gist')
    await phone.goto('/library')
    await expect(phone.locator('article').first()).toContainText('论语·学而第一')
    await expect(phone.locator('article').first()).toContainText('0/2')

    // 手机：再导入一篇 → 同步；电脑：同步 → 两篇都在
    await seedWork(phone, { title: '道德经·第一章', lines: ['道可道，非常道。'] })
    await syncNow(phone, 'Gist')
    await syncNow(desktop, 'Gist')
    await desktop.goto('/library')
    await desktop.getByRole('button', { name: '篇目一览' }).click()
    await expect(desktop.locator('ul li > button', { hasText: '道德经·第一章' })).toBeVisible()

    // 电脑：删掉道德经 → 同步；手机：同步 → 那篇消失，论语还在（墓碑生效）
    await desktop.getByRole('button', { name: '关闭' }).click()
    await openWork(desktop, '道德经·第一章')
    await expect(desktop.locator('article').first()).toContainText('道德经·第一章')
    await desktop.getByRole('button', { name: '删除篇目' }).click()
    await desktop.getByRole('button', { name: '删除', exact: true }).click()
    await syncNow(desktop, 'Gist')

    await syncNow(phone, 'Gist')
    await phone.goto('/library')
    await expect(phone.locator('article').first()).toContainText('论语·学而第一')
    await phone.getByRole('button', { name: '篇目一览' }).click()
    await expect(phone.getByText('道德经·第一章')).toHaveCount(0)

    await desktopCtx.close()
    await phoneCtx.close()
  })

  test('没令牌时同步按钮会引导去粘贴令牌', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('button', { name: '请先粘贴令牌' })).toBeVisible()
    await page.getByRole('button', { name: '请先粘贴令牌' }).click()
    await expect(page.getByText('请先粘贴 GitHub 令牌（只勾 gists 权限）')).toBeVisible()
    await expect(page.getByLabel('GitHub 令牌')).toBeVisible()
  })

  test('令牌为空时不会发起同步，本地数据不受影响', async ({ page }) => {
    await seedWork(page, { title: '测试篇目', lines: ['一句。'] })
    await page.goto('/settings')
    await page.getByRole('button', { name: /GitHub 令牌/ }).click()
    await page.getByLabel('GitHub API 地址').fill(GITHUB_API)
    await page.getByLabel('GitHub 令牌').fill('   ')
    await page.getByRole('button', { name: '请先粘贴令牌' }).click()
    await expect(page.getByText('请先粘贴 GitHub 令牌（只勾 gists 权限）')).toBeVisible()
    // 本地内容依然在
    await page.goto('/library')
    await expect(page.locator('article').first()).toContainText('测试篇目')
  })

  test('令牌失效时给出明确提示，本地数据完好（换新令牌即可继续）', async ({ page }) => {
    await seedWork(page, { title: '过期测试篇目', lines: ['一句。'] })
    await configureGistSync(page, 'expired-token')
    await page.getByRole('button', { name: '同步', exact: true }).click()
    await expect(page.getByText('GitHub 令牌无效或已过期')).toBeVisible({ timeout: 10_000 })
    // 同步失败不影响本地数据与离线使用
    await page.goto('/library')
    await expect(page.locator('article').first()).toContainText('过期测试篇目')
    await page.goto('/review')
    await expect(page.locator('.panel').first()).toContainText('今天需背 1 篇')
  })
})
