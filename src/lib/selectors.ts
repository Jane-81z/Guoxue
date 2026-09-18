import type { AudioAsset, DailyStat, Passage, Work } from '../types'
import { MASTERED_THRESHOLD, createSrsState, isDue, masteryScore } from './srs'

export function workMap(works: Work[]): Map<string, Work> {
  return new Map(works.map((w) => [w.id, w]))
}

export function passagesOfWork(passages: Passage[], workId: string): Passage[] {
  return passages.filter((p) => p.workId === workId).sort((a, b) => a.order - b.order)
}

/** 篇级排期的兜底：老数据没有 srs 时按「今天到期」处理 */
function workSrs(work: Work, today: string) {
  return work.srs ?? { ...createSrsState(today) }
}

/**
 * 今日队列：以「篇」为单位——该篇有要背的段，且篇级排期已到。
 * 先按到期日，再按熟练度升序。
 */
export function dueWorks(works: Work[], passages: Passage[], today: string): Work[] {
  const reciteByWork = new Set(passages.filter((p) => p.isRecite).map((p) => p.workId))
  return works
    .filter((w) => reciteByWork.has(w.id))
    .map((w) => ({ work: w, srs: workSrs(w, today) }))
    .filter((entry) => isDue(entry.srs, today))
    .sort((a, b) => {
      if (a.srs.dueAt !== b.srs.dueAt) return a.srs.dueAt < b.srs.dueAt ? -1 : 1
      const ma = masteryScore(a.srs)
      const mb = masteryScore(b.srs)
      if (ma !== mb) return ma - mb
      return a.work.createdAt - b.work.createdAt
    })
    .map((entry) => entry.work)
}

/** 该篇在复习时会出现的内容：只要背的段，按顺序 */
export function recitePassagesOf(passages: Passage[], workId: string): Passage[] {
  return passagesOfWork(passages, workId).filter((p) => p.isRecite)
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
  const srs = workSrs(work, today)
  return {
    work,
    total: items.length,
    reciteCount: recite.length,
    // 篇级：复习一次就算「已背」，段数只用来显示这一篇有多少段要背
    reviewedCount: srs.history.length > 0 ? recite.length : 0,
    dueCount: recite.length > 0 && isDue(srs, today) ? recite.length : 0,
    audioCount: items.filter((p) => p.audioId).length,
    mastery: recite.length ? masteryScore(srs) : 0,
    masteredCount: recite.length && masteryScore(srs) >= MASTERED_THRESHOLD ? recite.length : 0,
    reviewedTotal: srs.history.length,
    lastReviewedAt: srs.lastReviewedAt,
  }
}

export interface OverallStats {
  totalWorks: number
  reciteWorks: number
  /** 复习过的篇数 */
  startedWorks: number
  /** 已背篇目：至少完成过一次复习的篇 */
  finishedWorks: number
  totalPassages: number
  recitePassages: number
  /** 精熟的篇数 */
  masteredWorks: number
  /** 今日待复习：篇数 */
  dueWorks: number
  /** 今天已完成：篇数 */
  reviewedToday: number
  /** 今日待复习篇里一共还有多少段 */
  duePassages: number
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
  const reciteWorks = works.filter((w) => passages.some((p) => p.workId === w.id && p.isRecite))
  for (const work of reciteWorks) {
    const score = masteryScore(workSrs(work, today))
    if (score <= 0) bandCounts.new += 1
    else if (score < 40) bandCounts.learning += 1
    else if (score < MASTERED_THRESHOLD) bandCounts.familiar += 1
    else bandCounts.mastered += 1
  }
  const dueList = dueWorks(works, passages, today)
  const duePassageCount = dueList.reduce(
    (sum, work) => sum + recitePassagesOf(passages, work.id).length,
    0,
  )
  const todayStat = dailyStats.find((s) => s.date === today)
  const reviewedWorks = reciteWorks.filter((w) => workSrs(w, today).history.length > 0)
  return {
    totalWorks: works.length,
    reciteWorks: reciteWorks.length,
    startedWorks: reviewedWorks.length,
    finishedWorks: reviewedWorks.length,
    totalPassages: passages.length,
    recitePassages: recite.length,
    masteredWorks: bandCounts.mastered,
    dueWorks: dueList.length,
    reviewedToday: todayStat?.reviewedCount ?? 0,
    duePassages: duePassageCount,
    totalReviews: dailyStats.reduce((sum, s) => sum + s.reviewedCount, 0),
    averageMastery: reciteWorks.length
      ? Math.round(
          reciteWorks.reduce((sum, w) => sum + masteryScore(workSrs(w, today)), 0) /
            reciteWorks.length,
        )
      : 0,
    bandCounts,
  }
}

export function audioByPassageId(audios: AudioAsset[]): Map<string, AudioAsset> {
  // 整篇录音（passageId 为 null）不进这张表——它由段落自己的 audioId + 区间决定
  return new Map(
    audios.filter((a): a is AudioAsset & { passageId: string } => !!a.passageId).map((a) => [
      a.passageId,
      a,
    ]),
  )
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
