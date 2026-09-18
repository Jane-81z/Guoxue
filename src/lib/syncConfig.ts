/**
 * 云同步的配置与约定。
 * 没有账号：同步码就是钥匙——两端输入同一个码即视为同一份数据。
 * 端点固定为部署好的同步服务（Cloudflare Pages Function），使用者只需要填码。
 */
export const DEFAULT_SYNC_ENDPOINT = 'https://guoxue-sync.pages.dev/api/sync'

/** GitHub Gist 作为云端的接口地址（测试时会指向本机替身） */
export const DEFAULT_GITHUB_API = 'https://api.github.com'

/**
 * 云端的两种存法：
 * - `gist`：用一个 GitHub Gist 存整份数据（推荐，因为 GitHub 在国内可达）
 * - `cloudflare`：用 Cloudflare Pages Function + KV（更快，但控制台在部分网络打不开）
 */
export type SyncProvider = 'gist' | 'cloudflare'

/** 同步码：去掉容易看错的字符（0/O、1/I/l） */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const SYNC_CODE_LENGTH = 12

export interface SyncConfig {
  provider: SyncProvider
  /** 同步码，空字符串表示尚未开启同步 */
  code: string
  endpoint: string
  /** GitHub 令牌（只勾 Gists 读写），仅存在本机，不参与同步 */
  token: string
  /** 找到或创建出来的 Gist id */
  gistId: string
  /** GitHub API 地址，一般不用改 */
  api: string
  auto: boolean
  lastSyncedAt: number | null
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  provider: 'gist',
  code: '',
  endpoint: DEFAULT_SYNC_ENDPOINT,
  token: '',
  gistId: '',
  api: DEFAULT_GITHUB_API,
  auto: false,
  lastSyncedAt: null,
}

export function generateSyncCode(length = SYNC_CODE_LENGTH): string {
  const bytes = new Uint8Array(length)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

/** 码的规范形式：大写、去掉空格与连字符 */
export function normalizeSyncCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidSyncCode(input: string): boolean {
  return normalizeSyncCode(input).length >= 8
}

/** 显示成 4 位一组，方便两边核对 */
export function formatSyncCode(input: string): string {
  return normalizeSyncCode(input).replace(/(.{4})(?=.)/g, '$1 ')
}
