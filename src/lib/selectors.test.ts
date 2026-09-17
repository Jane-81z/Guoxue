import { describe, expect, it } from 'vitest'
import { duePassages, overallStats, passagesOfWork, workProgress } from './selectors'
import { createSrsState, schedule } from './srs'
import type { DailyStat, Passage, Work } from '../types'

const TODAY = '2026-09-17'

function work(id: string, title: string): Work {
  return { id, title, tags: [], createdAt: 0, updatedAt: 0 }
}

function passage(id: string, workId: string, order: number, extras: Partial<Passage> = {}): Passage {
  return {
    id,
    workId,
    order,
    text: `第${order + 1}段`,
    isRecite: true,
    pinyinOverrides: {},
    pinyinCache: null,
    note: '',
    audioId: null,
    srs: createSrsState(TODAY),
    createdAt: 0,
    updatedAt: 0,
    ...extras,
  }
}

describe('duePassages', () => {
  it('只取要背且到期的段落，新卡排在前', () => {
    const fluent = schedule(createSrsState(TODAY), 'fluent', TODAY)
    const passages = [
      passage('a', 'w1', 0, { srs: fluent }),
      passage('b', 'w1', 1),
      passage('c', 'w1', 2, { isRecite: false }),
    ]
    const due = duePassages(passages, TODAY)
    // 今天评为「流畅」的卡片下次到期是明天，所以只剩新卡待复习
    expect(due.map((p) => p.id)).toEqual(['b'])
  })

  it('未到期的不入队', () => {
    const future = schedule(createSrsState(TODAY), 'fluent', TODAY)
    const passages = [passage('a', 'w1', 0, { srs: future })]
    expect(duePassages(passages, '2026-09-16')).toHaveLength(0)
    expect(duePassages(passages, '2026-09-17')).toHaveLength(0)
    expect(duePassages(passages, '2026-09-18')).toHaveLength(1)
  })

  it('逾期卡片排在前面', () => {
    const passages = [
      passage('new', 'w1', 0),
      passage('overdue', 'w1', 1, {
        srs: { ...createSrsState('2026-09-10'), dueAt: '2026-09-10', history: [{ date: '2026-09-09', rating: 'hard' as const }], lastReviewedAt: '2026-09-09', repetitions: 1, intervalDays: 1, ease: 2.36 },
      }),
    ]
    expect(duePassages(passages, TODAY).map((p) => p.id)).toEqual(['overdue', 'new'])
  })
})

describe('workProgress', () => {
  it('统计要背段数、已背段数、待复习与录音数', () => {
    const w = work('w1', '论语')
    const reviewed = schedule(createSrsState(TODAY), 'fluent', TODAY)
    const passages = [
      passage('a', 'w1', 0, { srs: reviewed, audioId: 'x' }),
      passage('b', 'w1', 1),
      passage('c', 'w1', 2, { isRecite: false }),
    ]
    const progress = workProgress(w, passages, TODAY)
    expect(progress.total).toBe(3)
    expect(progress.reciteCount).toBe(2)
    expect(progress.reviewedCount).toBe(1)
    expect(progress.audioCount).toBe(1)
    expect(progress.reviewedTotal).toBe(1)
    expect(progress.dueCount).toBe(1)
  })
})

describe('overallStats', () => {
  it('汇总篇目、段落、今日复习与累计次数', () => {
    const works = [work('w1', '论语'), work('w2', '道德经')]
    const passages = [
      passage('a', 'w1', 0),
      passage('b', 'w1', 1, { isRecite: false }),
      passage('c', 'w2', 0),
    ]
    const stats: DailyStat[] = [
      {
        date: TODAY,
        reviewedCount: 3,
        ratings: { blank: 0, hard: 1, rusty: 1, fluent: 1 },
        workIds: ['w1'],
        checkedIn: false,
        updatedAt: 0,
      },
      {
        date: '2026-09-16',
        reviewedCount: 2,
        ratings: { blank: 0, hard: 0, rusty: 1, fluent: 1 },
        workIds: ['w2'],
        checkedIn: true,
        updatedAt: 0,
      },
    ]
    const result = overallStats(works, passages, TODAY, stats)
    expect(result.totalWorks).toBe(2)
    expect(result.recitePassages).toBe(2)
    expect(result.dueCount).toBe(2)
    expect(result.dueWorks).toBe(2)
    expect(result.reviewedToday).toBe(3)
    expect(result.totalReviews).toBe(5)
    expect(result.bandCounts.new).toBe(2)
  })
})

describe('passagesOfWork', () => {
  it('按 order 排序返回', () => {
    const passages = [passage('b', 'w1', 1), passage('a', 'w1', 0)]
    expect(passagesOfWork(passages, 'w1').map((p) => p.id)).toEqual(['a', 'b'])
  })
})
