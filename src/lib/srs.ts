import type { RatingKey, SrsState } from '../types'
import { addDays } from './date'

export interface RatingMeta {
  key: RatingKey
  label: string
  /** SM-2 质量分 */
  q: number
  hint: string
  /** tailwind 类名，用于按钮配色 */
  className: string
}

export const RATINGS: RatingMeta[] = [
  {
    key: 'blank',
    label: '完全不会',
    q: 0,
    hint: '重新开始，明天再来',
    className: 'border-cinnabar/45 text-cinnabar hover:bg-cinnabar/5',
  },
  {
    key: 'hard',
    label: '吃力',
    q: 3,
    hint: '勉强背下来，间隔缩短',
    className: 'border-cinnabar/25 text-ink-soft hover:bg-cinnabar/5',
  },
  {
    key: 'rusty',
    label: '略有卡顿',
    q: 4,
    hint: '基本顺畅，正常推进',
    className: 'border-jade/30 text-ink-soft hover:bg-jade/5',
  },
  {
    key: 'fluent',
    label: '流畅背诵',
    q: 5,
    hint: '脱口而出，间隔拉长',
    className: 'border-jade/50 text-jade hover:bg-jade/5',
  },
]

export const RATING_MAP: Record<RatingKey, RatingMeta> = RATINGS.reduce(
  (acc, r) => {
    acc[r.key] = r
    return acc
  },
  {} as Record<RatingKey, RatingMeta>,
)

export const EASE_MIN = 1.3
export const EASE_MAX = 2.8
export const DEFAULT_EASE = 2.5
/** 间隔上限（天），避免多年后溢出 */
export const MAX_INTERVAL_DAYS = 3650
/** 熟练度达到该分数视为「已掌握」 */
export const MASTERED_THRESHOLD = 70

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createSrsState(today: string): SrsState {
  return {
    ease: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueAt: today,
    lastRating: null,
    lastReviewedAt: null,
    history: [],
  }
}

/**
 * SM-2 简化版。四个评分映射到 q = 0 / 3 / 4 / 5。
 * - q < 3：repetitions 归零，间隔回到 1 天
 * - q >= 3：第 1 次 1 天，第 2 次 6 天，之后 interval * ease
 * - EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))，夹在 1.3 – 2.8
 */
export function schedule(state: SrsState, rating: RatingKey, today: string): SrsState {
  const q = RATING_MAP[rating].q
  const ease = clamp(
    state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
    EASE_MIN,
    EASE_MAX,
  )

  let repetitions: number
  let intervalDays: number

  if (q < 3) {
    repetitions = 0
    intervalDays = 1
  } else {
    repetitions = state.repetitions + 1
    if (repetitions === 1) intervalDays = 1
    else if (repetitions === 2) intervalDays = 6
    else intervalDays = Math.round(Math.max(state.intervalDays, 1) * ease)
    intervalDays = clamp(intervalDays, 1, MAX_INTERVAL_DAYS)
  }

  return {
    ease: Number(ease.toFixed(4)),
    intervalDays,
    repetitions,
    dueAt: addDays(today, intervalDays),
    lastRating: rating,
    lastReviewedAt: today,
    history: [...state.history, { date: today, rating }],
  }
}

/**
 * 0–100 熟练度：
 * 间隔因子（60）+ 稳定度因子（25）+ 最近三次评分因子（15）。
 * 从未复习过的新卡为 0。
 */
export function masteryScore(srs: SrsState): number {
  if (!srs.history.length) return 0
  const intervalFactor = Math.min(1, Math.log2(Math.max(srs.intervalDays, 0) + 1) / Math.log2(181))
  const easeFactor = (clamp(srs.ease, EASE_MIN, EASE_MAX) - EASE_MIN) / (EASE_MAX - EASE_MIN)
  const recent = srs.history.slice(-3)
  const recentFactor =
    recent.reduce((sum, entry) => sum + RATING_MAP[entry.rating].q / 5, 0) / recent.length
  return Math.round(clamp(intervalFactor * 60 + easeFactor * 25 + recentFactor * 15, 0, 100))
}

export type MasteryBandKey = 'new' | 'learning' | 'familiar' | 'mastered'

export interface MasteryBand {
  key: MasteryBandKey
  label: string
  className: string
}

export function masteryBand(score: number): MasteryBand {
  if (score <= 0) return { key: 'new', label: '未开始', className: 'bg-ink-pale' }
  if (score < 40) return { key: 'learning', label: '初记', className: 'bg-cinnabar-pale' }
  if (score < MASTERED_THRESHOLD) return { key: 'familiar', label: '渐熟', className: 'bg-jade-pale' }
  return { key: 'mastered', label: '精熟', className: 'bg-jade' }
}

/** 到期判定：按本地日期比较 */
export function isDue(srs: SrsState, today: string): boolean {
  if (!srs.lastReviewedAt && !srs.history.length) return true
  return srs.dueAt <= today
}

export function isMastered(srs: SrsState): boolean {
  return masteryScore(srs) >= MASTERED_THRESHOLD
}
