import type { AudioAsset, DailyStat, Passage, Work } from '../types'
import { MASTERED_THRESHOLD, isDue, masteryScore } from './srs'

export function workMap(works: Work[]): Map<string, Work> {
  return new Map(works.map((w) => [w.id, w]))
}

export function passagesOfWork(passages: Passage[], workId: string): Passage[] {
  return passages.filter((p) => p.workId === workId).sort((a, b) => a.order - b.order)
}

/** 今日队列：要背、已到期。先按到期日，再按熟练度升序 */
export function duePassages(passages: Passage[], today: string): Passage[] {
  return passages
    .filter((p) => p.isRecite && isDue(p.srs, today))
    .sort((a, b) => {
      if (a.srs.dueAt !== b.srs.dueAt) return a.srs.dueAt < b.srs.dueAt ? -1 : 1
      const ma = masteryScore(a.srs)
      const mb = masteryScore(b.srs)
      if (ma !== mb) return ma - mb
      return a.order - b.order
    })
}

export interface WorkProgress {
  work: Work
  total: number
  reciteCount: number
  reviewedCount: number
  dueCount: number
  audioCount: number
  mastery: number
  masteredCount: number
  reviewedTotal: number
  lastReviewedAt: string | null
}

export function workProgress(
  work: Work,
  passages: Passage[],
  today: string,
): WorkProgress {
  const items = passagesOfWork(passages, work.id)
  const recite = items.filter((p) => p.isRecite)
  const reviewed = recite.filter((p) => p.srs.history.length > 0)
  const mastery = recite.length
    ? Math.round(recite.reduce((sum, p) => sum + masteryScore(p.srs), 0) / recite.length)
    : 0
  const lastReviewedAt =
    items
      .map((p) => p.srs.lastReviewedAt)
      .filter((v): v is string => !!v)
      .sort()
      .pop() ?? null
  return {
    work,
    total: items.length,
    reciteCount: recite.length,
    reviewedCount: reviewed.length,
    dueCount: recite.filter((p) => isDue(p.srs, today)).length,
    audioCount: items.filter((p) => p.audioId).length,
    mastery,
    masteredCount: recite.filter((p) => masteryScore(p.srs) >= MASTERED_THRESHOLD).length,
    reviewedTotal: items.reduce((sum, p) => sum + p.srs.history.length, 0),
    lastReviewedAt,
  }
}

export interface OverallStats {
  totalWorks: number
  reciteWorks: number
  startedWorks: number
  finishedWorks: number
  totalPassages: number
  recitePassages: number
  masteredPassages: number
  dueCount: number
  reviewedToday: number
  dueWorks: number
  totalReviews: number
  averageMastery: number
  bandCounts: { new: number; learning: number; familiar: number; mastered: number }
}

export function overallStats(
  works: Work[],
  passages: Passage[],
  today: string,
  dailyStats: DailyStat[],
): OverallStats {
  const recite = passages.filter((p) => p.isRecite)
  const bandCounts = { new: 0, learning: 0, familiar: 0, mastered: 0 }
  for (const p of recite) {
    const score = masteryScore(p.srs)
    if (score <= 0) bandCounts.new += 1
    else if (score < 40) bandCounts.learning += 1
    else if (score < MASTERED_THRESHOLD) bandCounts.familiar += 1
    else bandCounts.mastered += 1
  }
  const progressList = works.map((w) => workProgress(w, passages, today))
  const dueList = duePassages(passages, today)
  const todayStat = dailyStats.find((s) => s.date === today)
  return {
    totalWorks: works.length,
    reciteWorks: works.filter((w) => passages.some((p) => p.workId === w.id && p.isRecite)).length,
    startedWorks: progressList.filter((w) => w.reviewedCount > 0).length,
    finishedWorks: progressList.filter((w) => w.reciteCount > 0 && w.reviewedCount === w.reciteCount)
      .length,
    totalPassages: passages.length,
    recitePassages: recite.length,
    masteredPassages: bandCounts.mastered,
    dueCount: dueList.length,
    reviewedToday: todayStat?.reviewedCount ?? 0,
    dueWorks: new Set(dueList.map((p) => p.workId)).size,
    totalReviews: dailyStats.reduce((sum, s) => sum + s.reviewedCount, 0),
    averageMastery: recite.length
      ? Math.round(recite.reduce((sum, p) => sum + masteryScore(p.srs), 0) / recite.length)
      : 0,
    bandCounts,
  }
}

export function audioByPassageId(audios: AudioAsset[]): Map<string, AudioAsset> {
  return new Map(audios.map((a) => [a.passageId, a]))
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '--:--'
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function formatRelativeTime(ts: number | null | undefined): string {
  if (!ts) return '从未复习'
  const diff = Date.now() - ts
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}
