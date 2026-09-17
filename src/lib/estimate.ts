import type { Passage } from '../types'

/** 默认背诵速度：字/分钟。无录音时用它把字数换算成时间。 */
export const DEFAULT_RECITE_PACE = 150
export const MIN_RECITE_PACE = 120
export const MAX_RECITE_PACE = 200
/** 每段的固定开销：评分、翻页、回神 */
export const PER_PASSAGE_OVERHEAD_SECONDS = 8
/** 有录音时按录音时长上浮的比例，留给回忆停顿 */
export const AUDIO_OVERHEAD_RATIO = 1.15

const COUNTABLE = /[\p{Script=Han}\p{L}\p{N}]/u

/** 只数要读出来的字：汉字、字母、数字；标点与空白不计 */
export function countRecitableChars(text: string): number {
  let count = 0
  for (const ch of text) if (COUNTABLE.test(ch)) count += 1
  return count
}

export function clampPace(pace: number | undefined): number {
  if (!pace || !Number.isFinite(pace)) return DEFAULT_RECITE_PACE
  return Math.min(MAX_RECITE_PACE, Math.max(MIN_RECITE_PACE, Math.round(pace)))
}

/**
 * 单段预计用时（秒）。
 * 有录音就以录音长度为基准（这是真实测量），否则按字数与背诵速度估算。
 * 两者都加上固定的评分开销。
 */
export function passageSeconds(
  text: string,
  audioDurationMs: number | null | undefined,
  pace: number = DEFAULT_RECITE_PACE,
): number {
  const base =
    audioDurationMs && audioDurationMs > 0
      ? (audioDurationMs / 1000) * AUDIO_OVERHEAD_RATIO
      : (countRecitableChars(text) / clampPace(pace)) * 60
  return Math.round(base + PER_PASSAGE_OVERHEAD_SECONDS)
}

/** 今日剩余的预计总用时（秒） */
export function sessionSeconds(
  passages: Passage[],
  audioDurationByPassage: Map<string, number | null | undefined>,
  pace: number = DEFAULT_RECITE_PACE,
): number {
  return passages.reduce(
    (sum, passage) =>
      sum + passageSeconds(passage.text, audioDurationByPassage.get(passage.id), pace),
    0,
  )
}

/** 向上取整到分钟；不足 1 分钟返回 1，除非本来就是 0 */
export function estimateMinutes(seconds: number): number {
  if (seconds <= 0) return 0
  return Math.max(1, Math.ceil(seconds / 60))
}

/** 读数用的两位数字，例如 6 -> "06" */
export function readoutDigits(minutes: number): string {
  return String(Math.min(99, Math.max(0, minutes))).padStart(2, '0')
}

export function formatEstimate(seconds: number): string {
  const minutes = estimateMinutes(seconds)
  if (minutes === 0) return '今天没有要背的'
  if (seconds < 60) return '不到 1 分钟'
  if (minutes < 60) return `约 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `约 ${hours} 小时 ${rest} 分` : `约 ${hours} 小时`
}
