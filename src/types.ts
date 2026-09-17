/** 四档评分：完全不会 / 吃力 / 略有卡顿 / 流畅背诵 */
export type RatingKey = 'blank' | 'hard' | 'rusty' | 'fluent'

export interface RatingHistoryEntry {
  /** 本地日期 YYYY-MM-DD */
  date: string
  rating: RatingKey
}

export interface SrsState {
  /** 难度系数，区间 1.3 – 2.8 */
  ease: number
  /** 当前间隔天数 */
  intervalDays: number
  /** 连续答对次数（q >= 3 累计） */
  repetitions: number
  /** 下次复习日期，本地日期 YYYY-MM-DD */
  dueAt: string
  lastRating: RatingKey | null
  lastReviewedAt: string | null
  history: RatingHistoryEntry[]
}

/** 篇目 */
export interface Work {
  id: string
  title: string
  author?: string
  dynasty?: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

/** 段落（卡片）。workId 是归属关系的唯一事实来源，passageIds 由查询派生。 */
export interface Passage {
  id: string
  workId: string
  /** 篇目内的顺序，从 0 开始 */
  order: number
  text: string
  /** 是否需要背诵 */
  isRecite: boolean
  /** 逐字拼音人工修正：键为码点序号（从 0 开始），值为拼音 */
  pinyinOverrides: Record<string, string>
  /** 自动注音缓存，JSON 序列化的 RubyToken[] */
  pinyinCache: string | null
  note: string
  audioId: string | null
  srs: SrsState
  createdAt: number
  updatedAt: number
}

/** 录音元数据（二进制单独存在 audioBlobs 表，避免一次性载入内存） */
export interface AudioAsset {
  id: string
  passageId: string
  workId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  durationMs: number | null
  createdAt: number
}

export interface AudioBlobRecord {
  id: string
  blob: Blob
}

/**
 * 每日统计。checkedIn 为 true 的那一行即对应「打卡」记录：
 * 当天所有到期卡片都评完分后自动写入。
 */
export interface DailyStat {
  /** YYYY-MM-DD */
  date: string
  reviewedCount: number
  ratings: Record<RatingKey, number>
  workIds: string[]
  checkedIn: boolean
  updatedAt: number
}

export type PlayMode = 'sequence' | 'repeatOne' | 'repeatAll'

export interface PlayerPrefs {
  rate: number
  /** 复读遍数：1 表示不重复 */
  repeatCount: number
  mode: PlayMode
  /** workId -> passageId，用于「继续上次听的地方」 */
  lastPlayed: Record<string, string>
  /** passageId -> 秒 */
  positions: Record<string, number>
}

export interface Settings {
  /** 视觉方向 id，见 src/theme/themes.ts */
  theme: string
  /** 背诵速度：字/分钟，用于估算今日用时 */
  recitePace: number
  /** HH:mm */
  reminderTime: string
  fontScale: number
  lineHeight: number
  /** 篇目页默认显示拼音 */
  pinyinVisible: boolean
  /** 复习页「显示原文」时一并显示拼音 */
  pinyinInReview: boolean
  /** 正文竖排显示 */
  vertical: boolean
  player: PlayerPrefs
}

export interface SettingsRecord {
  key: 'app'
  value: Settings
}

export interface RubyToken {
  /** 码点序号 */
  index: number
  char: string
  pinyin: string | null
}
