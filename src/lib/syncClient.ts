import { normalizeSyncCode } from './syncConfig'
import { isPayload, type SyncPayload } from './syncMerge'

/** 云端读取：没有这个同步码时返回 null（表示云端还没有这份数据） */
export async function pullPayload(
  endpoint: string,
  code: string,
): Promise<SyncPayload | null> {
  const url = `${endpoint}?code=${encodeURIComponent(normalizeSyncCode(code))}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`云端读取失败（${res.status}）`)
  const data: unknown = await res.json()
  if (!isPayload(data)) throw new Error('云端数据格式不认识')
  return data
}

export async function pushPayload(
  endpoint: string,
  code: string,
  payload: SyncPayload,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: normalizeSyncCode(code), payload }),
  })
  if (!res.ok) throw new Error(`云端写入失败（${res.status}）`)
}
