import JSZip from 'jszip'
import { db } from './db'
import type {
  AudioAsset,
  DailyStat,
  Passage,
  RatingKey,
  Settings,
  Work,
} from '../types'
import { newId } from '../lib/id'
import { buildPinyinCache } from '../lib/pinyin'
import { createSrsState, schedule } from '../lib/srs'
import { todayKey } from '../lib/date'
import { planMatch, type MatchPlan } from '../lib/match'
import { DEFAULT_SYNC_CONFIG } from '../lib/syncConfig'
import { buildPayload, isPayload, type SyncPayload } from '../lib/syncMerge'
import { DEFAULT_THEME_ID } from '../theme/themes'
import {
  BACKUP_APP_ID,
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  type BackupV1,
} from '../lib/backup'

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME_ID,
  sync: DEFAULT_SYNC_CONFIG,
  recitePace: 150,
  reminderTime: '20:00',
  fontScale: 1,
  lineHeight: 1.9,
  pinyinVisible: false,
  pinyinInReview: true,
  vertical: false,
  player: {
    rate: 1,
    repeatCount: 1,
    mode: 'sequence',
    lastPlayed: {},
    positions: {},
  },
}

export interface AppSnapshot {
  works: Work[]
  passages: Passage[]
  audios: AudioAsset[]
  dailyStats: DailyStat[]
  settings: Settings
}

const EMPTY_RATINGS: Record<RatingKey, number> = {
  blank: 0,
  hard: 0,
  rusty: 0,
  fluent: 0,
}

export function emptyDailyStat(date: string): DailyStat {
  return {
    date,
    reviewedCount: 0,
    ratings: { ...EMPTY_RATINGS },
    workIds: [],
    checkedIn: false,
    updatedAt: Date.now(),
  }
}

function mergeSettings(stored: Settings | undefined): Settings {
  if (!stored) return structuredClone(DEFAULT_SETTINGS)
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    player: { ...DEFAULT_SETTINGS.player, ...(stored.player ?? {}) },
    sync: { ...DEFAULT_SYNC_CONFIG, ...(stored.sync ?? {}) },
  }
}

/** 记下删除墓碑：同步时用它阻止「已删除的记录」被另一端带回来 */
async function writeTombstones(ids: string[], deletedAt = Date.now()): Promise<void> {
  if (!ids.length) return
  await db.tombstones.bulkPut(ids.map((id) => ({ id, deletedAt })))
}

export async function listTombstones(): Promise<Record<string, number>> {
  const rows = await db.tombstones.toArray()
  return Object.fromEntries(rows.map((row) => [row.id, row.deletedAt]))
}

export async function getSettings(): Promise<Settings> {
  const record = await db.settings.get('app')
  return mergeSettings(record?.value)
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next: Settings = { ...current, ...patch }
  if (patch.player) next.player = { ...current.player, ...patch.player }
  await db.settings.put({ key: 'app', value: next })
  return next
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  const [works, passages, audios, dailyStats, settings] = await Promise.all([
    db.works.toArray(),
    db.passages.toArray(),
    db.audios.toArray(),
    db.dailyStats.toArray(),
    getSettings(),
  ])
  works.sort((a, b) => a.createdAt - b.createdAt)
  passages.sort((a, b) => a.workId.localeCompare(b.workId) || a.order - b.order)
  dailyStats.sort((a, b) => a.date.localeCompare(b.date))
  return { works, passages, audios, dailyStats, settings }
}

export interface ImportWorkInput {
  title: string
  author?: string
  dynasty?: string
  tags?: string[]
  lines: string[]
  /** 与 lines 一一对应，true 表示要背 */
  reciteFlags: boolean[]
}

export async function createWork(input: ImportWorkInput): Promise<{ work: Work; passages: Passage[] }> {
  const today = todayKey()
  const now = Date.now()
  const work: Work = {
    id: newId(),
    title: input.title.trim(),
    author: input.author?.trim() || undefined,
    dynasty: input.dynasty?.trim() || undefined,
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
  }
  const passages: Passage[] = input.lines.map((text, index) => ({
    id: newId(),
    workId: work.id,
    order: index,
    text,
    isRecite: input.reciteFlags[index] ?? true,
    pinyinOverrides: {},
    pinyinCache: buildPinyinCache(text),
    note: '',
    audioId: null,
    srs: createSrsState(today),
    createdAt: now,
    updatedAt: now,
  }))
  await db.transaction('rw', db.works, db.passages, async () => {
    await db.works.add(work)
    await db.passages.bulkAdd(passages)
  })
  return { work, passages }
}

export async function updateWork(
  workId: string,
  patch: Partial<Pick<Work, 'title' | 'author' | 'dynasty' | 'tags'>>,
): Promise<void> {
  await db.works.update(workId, { ...patch, updatedAt: Date.now() })
}

export type PassagePatch = Partial<
  Pick<Passage, 'text' | 'note' | 'isRecite' | 'pinyinOverrides' | 'order'>
>

export async function updatePassage(passageId: string, patch: PassagePatch): Promise<void> {
  const next: PassagePatch & { updatedAt: number; pinyinCache?: string } = {
    ...patch,
    updatedAt: Date.now(),
  }
  if (typeof patch.text === 'string') next.pinyinCache = buildPinyinCache(patch.text)
  await db.passages.update(passageId, next)
}

/**
 * 用多行文本替换某一段：第一行沿用原段（保留录音与复习进度），
 * 其余行作为新段插入其后。用于「一段拆成多段」。
 */
export async function splitPassage(passageId: string, lines: string[]): Promise<void> {
  const passage = await db.passages.get(passageId)
  if (!passage) return
  const texts = lines.map((line) => line.trim()).filter(Boolean)
  if (!texts.length) return
  const siblings = await db.passages.where('workId').equals(passage.workId).toArray()
  siblings.sort((a, b) => a.order - b.order)
  const index = siblings.findIndex((p) => p.id === passageId)
  if (index < 0) return
  const now = Date.now()
  const today = todayKey()
  const extra = texts.length - 1

  await db.transaction('rw', db.passages, db.works, async () => {
    await db.passages.update(passageId, {
      text: texts[0],
      pinyinCache: buildPinyinCache(texts[0]),
      updatedAt: now,
    })
    for (let i = siblings.length - 1; i > index; i -= 1) {
      await db.passages.update(siblings[i].id, { order: siblings[i].order + extra })
    }
    if (extra > 0) {
      const created: Passage[] = texts.slice(1).map((text, k) => ({
        id: newId(),
        workId: passage.workId,
        order: passage.order + k + 1,
        text,
        isRecite: true,
        pinyinOverrides: {},
        pinyinCache: buildPinyinCache(text),
        note: '',
        audioId: null,
        srs: createSrsState(today),
        createdAt: now,
        updatedAt: now,
      }))
      await db.passages.bulkAdd(created)
    }
    await db.works.update(passage.workId, { updatedAt: now })
  })
}

/**
 * 重写整篇原文：按行匹配，保留同文本段落的录音与复习进度。
 * 返回匹配计划，调用方可据此提示用户影响范围。
 */
export async function applyWorkText(workId: string, lines: string[]): Promise<MatchPlan> {
  const oldPassages = await db.passages.where('workId').equals(workId).toArray()
  oldPassages.sort((a, b) => a.order - b.order)
  const plan = planMatch(oldPassages, lines)
  if (!plan.changed) return plan

  const now = Date.now()
  const today = todayKey()
  const removalIds = plan.removed.map((p) => p.id)
  const removalAudioIds = plan.removed.map((p) => p.audioId).filter((v): v is string => !!v)

  await db.transaction('rw', db.works, db.passages, db.audios, db.audioBlobs, async () => {
    if (removalIds.length) {
      await db.passages.bulkDelete(removalIds)
      await db.audios.where('passageId').anyOf(removalIds).delete()
      await db.audioBlobs.bulkDelete(removalAudioIds)
    }
    for (const item of plan.kept) {
      const old = oldPassages.find((p) => p.id === item.passageId)!
      const patch: PassagePatch & { updatedAt: number; pinyinCache?: string } = {
        order: item.newOrder,
        updatedAt: now,
      }
      if (old.text !== item.text) {
        patch.text = item.text
        patch.pinyinCache = buildPinyinCache(item.text)
      }
      await db.passages.update(item.passageId, patch)
    }
    if (plan.added.length) {
      const created: Passage[] = plan.added.map((item) => ({
        id: newId(),
        workId,
        order: item.newOrder,
        text: item.text,
        isRecite: true,
        pinyinOverrides: {},
        pinyinCache: buildPinyinCache(item.text),
        note: '',
        audioId: null,
        srs: createSrsState(today),
        createdAt: now,
        updatedAt: now,
      }))
      await db.passages.bulkAdd(created)
    }
    await db.works.update(workId, { updatedAt: now })
  })

  // 被删掉的段落在同步时需要墓碑，否则会被另一端带回来
  await writeTombstones(removalIds, now)

  return plan
}

export async function deletePassage(passageId: string): Promise<void> {
  const passage = await db.passages.get(passageId)
  if (!passage) return
  await db.transaction('rw', db.passages, db.audios, db.audioBlobs, async () => {
    await db.passages.delete(passageId)
    if (passage.audioId) {
      await db.audios.delete(passage.audioId)
      await db.audioBlobs.delete(passage.audioId)
    }
  })
  await writeTombstones([passageId])
}

export async function deleteWork(workId: string): Promise<void> {
  const passages = await db.passages.where('workId').equals(workId).toArray()
  const audioIds = passages.map((p) => p.audioId).filter((v): v is string => !!v)
  await db.transaction('rw', db.works, db.passages, db.audios, db.audioBlobs, async () => {
    await db.passages.where('workId').equals(workId).delete()
    await db.audios.where('workId').equals(workId).delete()
    await db.audioBlobs.bulkDelete(audioIds)
    await db.works.delete(workId)
  })
  await writeTombstones([workId, ...passages.map((p) => p.id)])
}

export async function resetPassageProgress(passageId: string): Promise<void> {
  await db.passages.update(passageId, { srs: createSrsState(todayKey()), updatedAt: Date.now() })
}

export async function resetWorkProgress(workId: string): Promise<void> {
  const today = todayKey()
  const ids = (await db.passages.where('workId').equals(workId).toArray()).map((p) => p.id)
  await db.transaction('rw', db.passages, async () => {
    for (const id of ids) {
      await db.passages.update(id, { srs: createSrsState(today), updatedAt: Date.now() })
    }
  })
}

function readAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = document.createElement('audio')
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      audio.removeAttribute('src')
      resolve(value)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null)
    audio.onerror = () => finish(null)
    audio.src = url
    window.setTimeout(() => finish(null), 8000)
  })
}

export async function attachAudio(passageId: string, file: File): Promise<AudioAsset> {
  const passage = await db.passages.get(passageId)
  if (!passage) throw new Error('段落不存在')
  const durationMs = await readAudioDuration(file)
  const asset: AudioAsset = {
    id: newId(),
    passageId,
    workId: passage.workId,
    fileName: file.name,
    mimeType: file.type || 'audio/mpeg',
    sizeBytes: file.size,
    durationMs,
    createdAt: Date.now(),
  }
  await db.transaction('rw', db.passages, db.audios, db.audioBlobs, async () => {
    if (passage.audioId) {
      await db.audios.delete(passage.audioId)
      await db.audioBlobs.delete(passage.audioId)
    }
    await db.audios.add(asset)
    await db.audioBlobs.add({ id: asset.id, blob: file })
    await db.passages.update(passageId, { audioId: asset.id, updatedAt: Date.now() })
  })
  return asset
}

export async function removeAudio(passageId: string): Promise<void> {
  const passage = await db.passages.get(passageId)
  if (!passage?.audioId) return
  const audioId = passage.audioId
  await db.transaction('rw', db.passages, db.audios, db.audioBlobs, async () => {
    await db.audios.delete(audioId)
    await db.audioBlobs.delete(audioId)
    await db.passages.update(passageId, { audioId: null, updatedAt: Date.now() })
  })
}

export async function getAudioBlob(audioId: string): Promise<Blob | null> {
  const record = await db.audioBlobs.get(audioId)
  return record?.blob ?? null
}

/** 评价一张卡：更新 SM-2 排期并累加当日统计 */
export async function reviewPassage(
  passageId: string,
  rating: RatingKey,
  today = todayKey(),
): Promise<void> {
  await db.transaction('rw', db.passages, db.dailyStats, async () => {
    const passage = await db.passages.get(passageId)
    if (!passage) return
    await db.passages.update(passageId, {
      srs: schedule(passage.srs, rating, today),
      updatedAt: Date.now(),
    })
    const stat = (await db.dailyStats.get(today)) ?? emptyDailyStat(today)
    const next: DailyStat = {
      ...stat,
      reviewedCount: stat.reviewedCount + 1,
      ratings: { ...stat.ratings, [rating]: (stat.ratings[rating] ?? 0) + 1 },
      workIds: stat.workIds.includes(passage.workId)
        ? stat.workIds
        : [...stat.workIds, passage.workId],
      updatedAt: Date.now(),
    }
    await db.dailyStats.put(next)
  })
}

/** 所有待背段落都评完分后自动打卡 */
export async function checkInIfDone(today = todayKey()): Promise<boolean> {
  const passages = await db.passages.toArray()
  const remaining = passages.filter((p) => p.isRecite && p.srs.dueAt <= today)
  if (remaining.length > 0) return false
  const stat = await db.dailyStats.get(today)
  if (!stat || stat.reviewedCount === 0 || stat.checkedIn) return false
  await db.dailyStats.put({ ...stat, checkedIn: true, updatedAt: Date.now() })
  return true
}

export async function exportBackupJson(): Promise<Blob> {
  const snapshot = await loadSnapshot()
  const backup = buildBackup(snapshot)
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
}

/** 覆盖导入：清空现有数据后写入备份内容。音频需另行导入，不会被清除。 */
export async function importBackupJson(text: string): Promise<BackupV1> {
  const backup = parseBackup(text)
  await db.transaction(
    'rw',
    db.works,
    db.passages,
    db.dailyStats,
    db.settings,
    async () => {
      await Promise.all([
        db.works.clear(),
        db.passages.clear(),
        db.dailyStats.clear(),
        db.settings.clear(),
      ])
      if (backup.works.length) await db.works.bulkAdd(backup.works)
      if (backup.passages.length) await db.passages.bulkAdd(backup.passages)
      if (backup.dailyStats.length) await db.dailyStats.bulkAdd(backup.dailyStats)
      await db.settings.put({ key: 'app', value: mergeSettings(backup.settings) })
    },
  )
  return backup
}

const ZIP_MANIFEST = 'manifest.json'

export async function exportAudioZip(): Promise<{ blob: Blob; count: number }> {
  const [audios, works] = await Promise.all([db.audios.toArray(), db.works.toArray()])
  const zip = new JSZip()
  const workTitle = (id: string) => works.find((w) => w.id === id)?.title ?? '未命名'
  const files: {
    path: string
    passageId: string
    workId: string
    fileName: string
    mimeType: string
    sizeBytes: number
  }[] = []

  for (const asset of audios) {
    const record = await db.audioBlobs.get(asset.id)
    if (!record) continue
    const rawExt = asset.fileName.includes('.') ? asset.fileName.split('.').pop()! : 'm4a'
    const safeExt = rawExt.replace(/[^A-Za-z0-9]/g, '') || 'm4a'
    const path = `audio/${workTitle(asset.workId)}/${asset.passageId}.${safeExt}`
    zip.file(path, record.blob)
    files.push({
      path,
      passageId: asset.passageId,
      workId: asset.workId,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    })
  }

  zip.file(
    ZIP_MANIFEST,
    JSON.stringify(
      { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), files },
      null,
      2,
    ),
  )

  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  return { blob, count: files.length }
}

export interface AudioImportResult {
  imported: number
  missing: number
  skipped: number
}

/** 按 manifest 里的 passageId 回挂录音；数据文件须先导入 */
export async function importAudioZip(file: File): Promise<AudioImportResult> {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file(ZIP_MANIFEST)
  if (!manifestFile) throw new Error('压缩包缺少 manifest.json，不是本应用的音频备份。')
  const manifest = JSON.parse(await manifestFile.async('string')) as {
    app?: string
    files?: {
      path: string
      passageId: string
      workId: string
      fileName: string
      mimeType: string
      sizeBytes: number
    }[]
  }
  if (manifest.app !== BACKUP_APP_ID || !Array.isArray(manifest.files)) {
    throw new Error('压缩包不是「国学背诵」的音频备份。')
  }

  let imported = 0
  let missing = 0
  let skipped = 0
  for (const entry of manifest.files) {
    const passage = await db.passages.get(entry.passageId)
    if (!passage) {
      missing += 1
      continue
    }
    const zipEntry = zip.file(entry.path)
    if (!zipEntry) {
      skipped += 1
      continue
    }
    const blob = await zipEntry.async('blob')
    await db.transaction('rw', db.passages, db.audios, db.audioBlobs, async () => {
      if (passage.audioId) {
        await db.audios.delete(passage.audioId)
        await db.audioBlobs.delete(passage.audioId)
      }
      const asset: AudioAsset = {
        id: newId(),
        passageId: entry.passageId,
        workId: passage.workId,
        fileName: entry.fileName,
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        durationMs: null,
        createdAt: Date.now(),
      }
      await db.audios.add(asset)
      await db.audioBlobs.add({ id: asset.id, blob })
      await db.passages.update(entry.passageId, { audioId: asset.id, updatedAt: Date.now() })
    })
    imported += 1
  }
  return { imported, missing, skipped }
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.works, db.passages, db.audios, db.audioBlobs, db.dailyStats, db.settings],
    async () => {
      await Promise.all([
        db.works.clear(),
        db.passages.clear(),
        db.audios.clear(),
        db.audioBlobs.clear(),
        db.dailyStats.clear(),
        db.settings.clear(),
      ])
    },
  )
}

// ——— 云同步：本地打包 / 应用合并结果 ———

export async function loadSyncPayload(): Promise<SyncPayload> {
  const snapshot = await loadSnapshot()
  return buildPayload({
    works: snapshot.works,
    passages: snapshot.passages,
    dailyStats: snapshot.dailyStats,
    tombstones: await listTombstones(),
  })
}

/**
 * 把合并结果写回本地。录音不参与同步：段落上的 audioId 原样保留，
 * 本机没有对应音频时播放会提示「录音数据缺失」，不会静默出错。
 */
export async function applySyncPayload(payload: SyncPayload): Promise<void> {
  if (!isPayload(payload)) throw new Error('云端数据格式不认识')
  await db.transaction(
    'rw',
    db.works,
    db.passages,
    db.dailyStats,
    db.tombstones,
    async () => {
      await Promise.all([
        db.works.clear(),
        db.passages.clear(),
        db.dailyStats.clear(),
        db.tombstones.clear(),
      ])
      if (payload.works.length) await db.works.bulkPut(payload.works)
      if (payload.passages.length) await db.passages.bulkPut(payload.passages)
      if (payload.dailyStats.length) await db.dailyStats.bulkPut(payload.dailyStats)
      const rows = Object.entries(payload.tombstones).map(([id, deletedAt]) => ({ id, deletedAt }))
      if (rows.length) await db.tombstones.bulkPut(rows)
    },
  )
}
