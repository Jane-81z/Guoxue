import { create } from 'zustand'
import type { AudioAsset, DailyStat, Passage, RatingKey, Settings, Work } from '../types'
import * as repo from '../db/repo'
import type { ImportWorkInput } from '../db/repo'
import type { MatchPlan } from '../lib/match'
import { splitPassages } from '../lib/split'
import { DEFAULT_SYNC_ENDPOINT, isValidSyncCode, normalizeSyncCode } from '../lib/syncConfig'
import { mergePayloads } from '../lib/syncMerge'
import { pullPayload, pushPayload } from '../lib/syncClient'
import { createGist, findGist, readGist, writeGist } from '../lib/syncGist'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

interface AppState {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  works: Work[]
  passages: Passage[]
  audios: AudioAsset[]
  dailyStats: DailyStat[]
  settings: Settings
  toast: ToastMessage | null
  checkInFlash: number

  init: () => Promise<void>
  refresh: () => Promise<void>
  notify: (message: string, tone?: ToastTone) => void
  dismissToast: () => void

  importWork: (input: ImportWorkInput) => Promise<Work>
  updateWorkMeta: (
    workId: string,
    patch: Partial<Pick<Work, 'title' | 'author' | 'dynasty' | 'tags'>>,
  ) => Promise<void>
  patchPassage: (
    passageId: string,
    patch: repo.PassagePatch,
  ) => Promise<void>
  savePassageEdit: (
    passageId: string,
    draft: { text: string; note: string; overrides: Record<string, string> },
  ) => Promise<void>
  rewriteWorkText: (workId: string, lines: string[]) => Promise<MatchPlan>
  removePassage: (passageId: string) => Promise<void>
  removeWork: (workId: string) => Promise<void>
  resetPassage: (passageId: string) => Promise<void>
  resetWork: (workId: string) => Promise<void>
  uploadAudio: (passageId: string, file: File) => Promise<void>
  uploadAudioBatch: (items: { passageId: string; file: File }[]) => Promise<void>
  attachWorkAudio: (
    workId: string,
    file: File,
    clips: repo.WorkClip[],
  ) => Promise<void>
  deleteAudio: (passageId: string) => Promise<void>
  /** 评价一整篇：更新篇级排期 + 按篇计入当日统计 */
  rateWork: (workId: string, rating: RatingKey) => Promise<void>
  /** 清空全部复习记录（原文与录音保留） */
  resetReviewRecords: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  clearAll: () => Promise<void>
  exportJson: () => Promise<void>
  importJson: (file: File) => Promise<void>
  exportAudio: () => Promise<void>
  importAudio: (file: File) => Promise<void>
  syncNow: () => Promise<void>
  updateSync: (patch: Partial<Settings['sync']>) => Promise<void>
}

const FALLBACK_SETTINGS: Settings = repo.DEFAULT_SETTINGS

let toastSeq = 0

export const useAppStore = create<AppState>()((set, get) => ({
  status: 'loading',
  error: null,
  works: [],
  passages: [],
  audios: [],
  dailyStats: [],
  settings: FALLBACK_SETTINGS,
  toast: null,
  checkInFlash: 0,

  init: async () => {
    try {
      // 升级到「按篇复习」时，旧记录一概作数不了：一次性清空排期与历史
      await repo.migrateToWorkReview()
      const snapshot = await repo.loadSnapshot()
      set({ ...snapshot, status: 'ready', error: null })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : '本地数据库打开失败',
      })
    }
  },

  refresh: async () => {
    const snapshot = await repo.loadSnapshot()
    set(snapshot)
  },

  notify: (message, tone = 'info') => {
    toastSeq += 1
    set({ toast: { id: toastSeq, message, tone } })
  },

  dismissToast: () => set({ toast: null }),

  importWork: async (input) => {
    const { work } = await repo.createWork(input)
    await get().refresh()
    get().notify(`已导入《${work.title}》`, 'success')
    return work
  },

  updateWorkMeta: async (workId, patch) => {
    await repo.updateWork(workId, patch)
    await get().refresh()
  },

  patchPassage: async (passageId, patch) => {
    await repo.updatePassage(passageId, patch)
    await get().refresh()
  },

  savePassageEdit: async (passageId, draft) => {
    const texts = splitPassages(draft.text)
    if (!texts.length) {
      get().notify('原文不能为空', 'error')
      return
    }
    if (texts.length === 1) {
      await repo.updatePassage(passageId, {
        text: texts[0],
        note: draft.note,
        pinyinOverrides: draft.overrides,
      })
    } else {
      await repo.splitPassage(passageId, texts)
      await repo.updatePassage(passageId, {
        note: draft.note,
        pinyinOverrides: draft.overrides,
      })
      get().notify(`已拆成 ${texts.length} 段，第 1 段保留原进度`, 'success')
    }
    await get().refresh()
  },

  rewriteWorkText: async (workId, lines) => {
    const plan = await repo.applyWorkText(workId, lines)
    await get().refresh()
    return plan
  },

  removePassage: async (passageId) => {
    await repo.deletePassage(passageId)
    await get().refresh()
    get().notify('已删除该段', 'success')
  },

  removeWork: async (workId) => {
    const work = get().works.find((w) => w.id === workId)
    await repo.deleteWork(workId)
    await get().refresh()
    get().notify(work ? `已删除《${work.title}》` : '已删除篇目', 'success')
  },

  resetPassage: async (passageId) => {
    await repo.resetPassageProgress(passageId)
    await get().refresh()
    get().notify('已重置该段进度', 'success')
  },

  resetWork: async (workId) => {
    await repo.resetWorkProgress(workId)
    await get().refresh()
    get().notify('已重置本篇全部进度', 'success')
  },

  uploadAudio: async (passageId, file) => {
    const asset = await repo.attachAudio(passageId, file)
    await get().refresh()
    get().notify(`已添加录音：${asset.fileName}`, 'success')
  },

  uploadAudioBatch: async (items) => {
    let done = 0
    for (const item of items) {
      try {
        await repo.attachAudio(item.passageId, item.file)
        done += 1
      } catch {
        // 单个失败不影响整批
      }
    }
    await get().refresh()
    get().notify(`已上传 ${done} / ${items.length} 段录音`, done === items.length ? 'success' : 'error')
  },

  attachWorkAudio: async (workId, file, clips) => {
    await repo.attachWorkAudio(workId, file, clips)
    await get().refresh()
    get().notify(`已导入整篇录音，切成 ${clips.length} 段`, 'success')
  },

  deleteAudio: async (passageId) => {
    await repo.removeAudio(passageId)
    await get().refresh()
    get().notify('已删除录音', 'success')
  },

  rateWork: async (workId, rating) => {
    await repo.reviewWork(workId, rating)
    const checked = await repo.checkInIfDone()
    await get().refresh()
    if (checked) {
      set({ checkInFlash: Date.now() })
      get().notify('今日任务全部完成，已自动打卡', 'success')
    }
  },

  resetReviewRecords: async () => {
    await repo.resetAllReviewRecords()
    await get().refresh()
    get().notify('已清空全部复习记录，所有篇目按新卡重新开始', 'success')
  },

  updateSettings: async (patch) => {
    const settings = await repo.saveSettings(patch)
    set({ settings })
  },

  clearAll: async () => {
    await repo.clearAllData()
    await get().refresh()
    get().notify('已清空全部数据', 'success')
  },

  exportJson: async () => {
    const blob = await repo.exportBackupJson()
    const { downloadBlob, stamp } = await import('../lib/backup')
    downloadBlob(blob, `国学背诵-数据-${stamp()}.json`)
    get().notify('数据备份已导出', 'success')
  },

  importJson: async (file) => {
    const text = await file.text()
    const backup = await repo.importBackupJson(text)
    await get().refresh()
    get().notify(
      `已导入 ${backup.works.length} 篇、${backup.passages.length} 段，录音需另行导入`,
      'success',
    )
  },

  exportAudio: async () => {
    const { blob, count } = await repo.exportAudioZip()
    if (count === 0) {
      get().notify('还没有任何录音可以导出', 'error')
      return
    }
    const { downloadBlob, stamp } = await import('../lib/backup')
    downloadBlob(blob, `国学背诵-录音-${stamp()}.zip`)
    get().notify(`已导出 ${count} 段录音`, 'success')
  },

  importAudio: async (file) => {
    const result = await repo.importAudioZip(file)
    await get().refresh()
    const parts = [`已回挂 ${result.imported} 段录音`]
    if (result.missing) parts.push(`${result.missing} 段找不到对应段落`)
    if (result.skipped) parts.push(`${result.skipped} 个文件缺失`)
    get().notify(parts.join('，'), result.missing ? 'error' : 'success')
  },

  /**
   * 一次完整同步：本地打包 → 拉远端 → 合并 → 写回本地 → 推回云端。
   * 云端有两种存法：GitHub Gist（默认，国内可达）与 Cloudflare KV。
   */
  syncNow: async () => {
    const { settings } = get()
    const sync = settings.sync
    try {
      const local = await repo.loadSyncPayload()

      let remote = null
      let persist: Partial<Settings['sync']> = {}
      let where = ''

      if (sync.provider === 'gist') {
        const token = sync.token.trim()
        if (!token) {
          get().notify('请先粘贴 GitHub 令牌（只勾 gists 权限）', 'error')
          return
        }
        const api = sync.api
        const gistId = sync.gistId || (await findGist(api, token)) || ''
        if (gistId) {
          remote = await readGist(api, token, gistId)
        }
        where = gistId ? 'Gist' : '新建 Gist'
        persist = { gistId, token, api }
      } else {
        const code = normalizeSyncCode(sync.code)
        if (!isValidSyncCode(code)) {
          get().notify('请先设置同步码（至少 8 位）', 'error')
          return
        }
        const endpoint = sync.endpoint || DEFAULT_SYNC_ENDPOINT
        remote = await pullPayload(endpoint, code)
        where = 'Cloudflare'
        persist = { code, endpoint }
      }

      const { payload, pulledIn, purged } = mergePayloads(local, remote)
      await repo.applySyncPayload(payload)

      if (sync.provider === 'gist') {
        const token = sync.token.trim()
        const api = sync.api
        const gistId = persist.gistId || (await findGist(api, token)) || ''
        if (gistId && remote) {
          await writeGist(api, token, gistId, payload)
        } else {
          const created = await createGist(api, token, payload)
          persist = { ...persist, gistId: created }
        }
      } else {
        await pushPayload(sync.endpoint || DEFAULT_SYNC_ENDPOINT, normalizeSyncCode(sync.code), payload)
      }

      const next = await repo.saveSettings({
        sync: { ...sync, ...persist, lastSyncedAt: Date.now() },
      })
      set({ settings: next })
      await get().refresh()
      const parts = [`已同步（${where}）：拉取 ${pulledIn} 条`]
      if (purged) parts.push(`清理 ${purged} 条已删除`)
      parts.push(`云端现有 ${payload.works.length} 篇 / ${payload.passages.length} 段`)
      get().notify(parts.join('，'), 'success')
    } catch (err) {
      get().notify(err instanceof Error ? err.message : '同步失败', 'error')
    }
  },

  updateSync: async (patch) => {
    const current = get().settings.sync
    const merged = { ...current, ...patch }
    if (patch.code !== undefined) merged.code = normalizeSyncCode(patch.code)
    await get().updateSettings({ sync: merged })
  },
}))
