import type { DailyStat, Passage, Work } from '../types'

/**
 * 同步载荷：两台设备之间交换的就是这一份。
 * 没有账号，只用同步码做键；服务端是个「哑」存储，合并逻辑全在这里，便于单测。
 */
export interface SyncPayload {
  schemaVersion: number
  /** 生成这份载荷的时间 */
  savedAt: number
  works: Work[]
  passages: Passage[]
  dailyStats: DailyStat[]
  /** 删除墓碑：记录 id -> 删除时间（毫秒）。没有它，删掉的东西会被另一端同步回来。 */
  tombstones: Record<string, number>
}

export const SYNC_SCHEMA_VERSION = 1
/** 墓碑保留期：超过这么久就可以安全丢弃 */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export function emptyPayload(now = Date.now()): SyncPayload {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    savedAt: now,
    works: [],
    passages: [],
    dailyStats: [],
    tombstones: {},
  }
}

interface Stamped {
  updatedAt?: number
  createdAt?: number
}

function stampOf(record: Stamped): number {
  return record.updatedAt ?? record.createdAt ?? 0
}

/** 同一 id 取「最后修改更晚」的那条；时间相同则取本地 */
function takeNewer<T extends Stamped>(local: T | undefined, remote: T | undefined): T | undefined {
  if (!local) return remote
  if (!remote) return local
  return stampOf(remote) > stampOf(local) ? remote : local
}

/**
 * 按 key 合并两个列表：同 key 取最后修改更晚的那条。
 * 篇目/段落用 id 作键，每日统计用日期作键。
 */
function mergeList<T extends Stamped>(local: T[], remote: T[], keyOf: (record: T) => string): T[] {
  const byKey = new Map<string, T>()
  for (const record of local) byKey.set(keyOf(record), record)
  for (const record of remote) {
    const key = keyOf(record)
    byKey.set(key, takeNewer(byKey.get(key), record) as T)
  }
  return [...byKey.values()]
}

/** 墓碑：取更晚的删除时间 */
function mergeTombstones(
  local: Record<string, number>,
  remote: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...local }
  for (const [id, deletedAt] of Object.entries(remote)) {
    merged[id] = Math.max(merged[id] ?? 0, deletedAt)
  }
  return merged
}

/** 被墓碑判死的记录：删除时间不早于它的最后修改时间 */
function isDead(id: string, record: Stamped, tombstones: Record<string, number>): boolean {
  const deletedAt = tombstones[id]
  return deletedAt !== undefined && deletedAt >= stampOf(record)
}

/** 丢弃过期墓碑，避免它无限增长 */
function pruneTombstones(
  tombstones: Record<string, number>,
  now: number,
): Record<string, number> {
  const kept: Record<string, number> = {}
  for (const [id, deletedAt] of Object.entries(tombstones)) {
    if (now - deletedAt < TOMBSTONE_TTL_MS) kept[id] = deletedAt
  }
  return kept
}

export interface MergeResult {
  payload: SyncPayload
  /** 这次合并从远端新拉下来的条目数 */
  pulledIn: number
  /** 墓碑清掉了多少条本地记录 */
  purged: number
}

/**
 * 合并本地与远端。可交换、可重复执行，所以两端各自算一次也会收敛到同一份数据。
 */
export function mergePayloads(
  local: SyncPayload,
  remote: SyncPayload | null,
  now = Date.now(),
): MergeResult {
  if (!remote) {
    return {
      payload: { ...local, savedAt: now, tombstones: pruneTombstones(local.tombstones, now) },
      pulledIn: 0,
      purged: 0,
    }
  }

  const tombstones = mergeTombstones(local.tombstones, remote.tombstones)

  const localIds = new Set([
    ...local.works.map((w) => w.id),
    ...local.passages.map((p) => p.id),
  ])
  const remoteIds = new Set([
    ...remote.works.map((w) => w.id),
    ...remote.passages.map((p) => p.id),
  ])

  const works = mergeList<Work>(local.works, remote.works, (w) => w.id).filter(
    (w) => !isDead(w.id, w, tombstones),
  )
  const passages = mergeList<Passage>(local.passages, remote.passages, (p) => p.id).filter(
    (p) => !isDead(p.id, p, tombstones),
  )
  const dailyStats = mergeList<DailyStat>(local.dailyStats, remote.dailyStats, (s) => s.date)

  const keptTombstones = pruneTombstones(tombstones, now)

  const mergedIds = new Set([...works.map((w) => w.id), ...passages.map((p) => p.id)])
  const pulledIn = [...mergedIds].filter((id) => !localIds.has(id) && remoteIds.has(id)).length
  const purged = [...localIds].filter((id) => !mergedIds.has(id)).length

  return {
    payload: {
      schemaVersion: SYNC_SCHEMA_VERSION,
      savedAt: now,
      works,
      passages,
      dailyStats,
      tombstones: keptTombstones,
    },
    pulledIn,
    purged,
  }
}

export function buildPayload(
  input: {
    works: Work[]
    passages: Passage[]
    dailyStats: DailyStat[]
    tombstones: Record<string, number>
  },
  now = Date.now(),
): SyncPayload {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    savedAt: now,
    works: input.works,
    passages: input.passages,
    dailyStats: input.dailyStats,
    tombstones: input.tombstones,
  }
}

/**
 * 同步载荷瘦身：去掉派生出来的注音缓存。
 *
 * pinyinCache 是「原文 + 人工修正」的纯派生结果，读端拿不到时会自动重算
 * （见 lib/pinyin.ts 的 resolveTokens），但它的体积是正文的十几倍
 * ——实测约 49 字节/汉字，而原文本身才 3 字节/汉字。
 * 云端的 GitHub Gist 对单个文件只返回前 1 MB，缓存会把这份载荷顶过线、
 * 读回来就是半截 JSON（「JSON 字符串未终止」）。
 */
export function slimPayload(payload: SyncPayload): SyncPayload {
  return {
    ...payload,
    passages: payload.passages.map((passage) =>
      passage.pinyinCache ? { ...passage, pinyinCache: null } : passage,
    ),
  }
}

/** 云端文件的实际体积（UTF-8 字节数，Gist 的 1 MB 上限就是按它算的） */
export function payloadBytes(payload: SyncPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length
}

/** GitHub Gist 单个文件的内容上限：超过就只返回前 1 MB */
export const GIST_CONTENT_LIMIT_BYTES = 1024 * 1024

export function isPayload(value: unknown): value is SyncPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SyncPayload>
  return (
    typeof candidate.schemaVersion === 'number' &&
    Array.isArray(candidate.works) &&
    Array.isArray(candidate.passages) &&
    Array.isArray(candidate.dailyStats) &&
    typeof candidate.tombstones === 'object'
  )
}
