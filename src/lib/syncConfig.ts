/**
 * 云同步的配置与约定。
 * 没有账号：同步码就是钥匙——两端输入同一个码即视为同一份数据。
 * 端点固定为部署好的同步服务（Cloudflare Pages Function），使用者只需要填码。
 */
export const DEFAULT_SYNC_ENDPOINT = 'https://guoxue-sync.pages.dev/api/sync'

/** 同步码：去掉容易看错的字符（0/O、1/I/l） */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const SYNC_CODE_LENGTH = 12

export interface SyncConfig {
  /** 同步码，空字符串表示尚未开启同步 */
  code: string
  endpoint: string
  auto: boolean
  lastSyncedAt: number | null
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  code: '',
  endpoint: DEFAULT_SYNC_ENDPOINT,
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
