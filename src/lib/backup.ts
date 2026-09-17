import type { DailyStat, Passage, Settings, Work } from '../types'

export const BACKUP_VERSION = 1
export const BACKUP_APP_ID = 'guoxue-recitation'

export interface BackupV1 {
  app: typeof BACKUP_APP_ID
  version: number
  exportedAt: string
  works: Work[]
  passages: Passage[]
  dailyStats: DailyStat[]
  settings: Settings
}

export function buildBackup(input: {
  works: Work[]
  passages: Passage[]
  dailyStats: DailyStat[]
  settings: Settings
}): BackupV1 {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    works: input.works,
    passages: input.passages,
    dailyStats: input.dailyStats,
    settings: input.settings,
  }
}

export function parseBackup(text: string): BackupV1 {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON，无法导入。')
  }
  const backup = data as Partial<BackupV1>
  if (backup?.app !== BACKUP_APP_ID) throw new Error('这不是「国学背诵」的备份文件。')
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('备份文件版本高于当前应用，请先更新应用。')
  }
  if (!Array.isArray(backup.works) || !Array.isArray(backup.passages)) {
    throw new Error('备份文件缺少篇目或段落数据。')
  }
  return {
    app: BACKUP_APP_ID,
    version: backup.version,
    exportedAt: backup.exportedAt ?? new Date().toISOString(),
    works: backup.works,
    passages: backup.passages,
    dailyStats: Array.isArray(backup.dailyStats) ? backup.dailyStats : [],
    settings: backup.settings as Settings,
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function stamp(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
