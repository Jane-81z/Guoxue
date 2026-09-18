import { describe, expect, it } from 'vitest'
import {
  dueWorks,
  overallStats,
  passagesOfWork,
  recitePassagesOf,
  workProgress,
} from './selectors'
import { createSrsState, schedule } from './srs'
import type { DailyStat, Passage, SrsState, Work } from '../types'

const TODAY = '2026-09-18'

function work(id: string, title: string, srs: SrsState = createSrsState(TODAY)): Work {
  return { id, title, tags: [], createdAt: 0, updatedAt: 0, srs }
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
    audioStartMs: null,
    audioEndMs: null,
    srs: createSrsState(TODAY),
    createdAt: 0,
    updatedAt: 0,
    ...extras,
  }
}

const reviewedToday = () => schedule(createSrsState(TODAY), 'fluent', TODAY)

describe('dueWorks', () => {
  it('新的篇今天到期，复习过的篇明天才到期', () => {
    const works = [work('w1', '论语'), work('w2', '道德经', reviewedToday())]
    const passages = [passage('a', 'w1', 0), passage('b', 'w2', 0)]
    expect(dueWorks(works, passages, TODAY).map((w) => w.id)).toEqual(['w1'])
    // 第二天：w2 到期；w1 因为一直没背而变成逾期，仍在队列里
    const tomorrow = dueWorks(works, passages, '2026-09-19').map((w) => w.id)
    expect(tomorrow).toContain('w2')
    expect(tomorrow).toContain('w1')
  })

  it('整篇都设成不背的篇不进复习队列', () => {
    const works = [work('w1', '论语')]
    const passages = [passage('a', 'w1', 0, { isRecite: false })]
    expect(dueWorks(works, passages, TODAY)).toHaveLength(0)
  })

  it('逾期篇排在前面，其余按熟练度升序', () => {
    const overdue = { ...createSrsState('2026-09-10'), dueAt: '2026-09-10', repetitions: 1 }
    const works = [work('fresh', '新篇'), work('late', '逾期篇', overdue)]
    const passages = [passage('a', 'fresh', 0), passage('b', 'late', 0)]
    expect(dueWorks(works, passages, TODAY).map((w) => w.id)).toEqual(['late', 'fresh'])
  })
})

describe('recitePassagesOf', () => {
  it('只返回要背的段，按顺序', () => {
    const passages = [
      passage('a', 'w1', 0),
      passage('b', 'w1', 1, { isRecite: false }),
      passage('c', 'w1', 2),
    ]
    expect(recitePassagesOf(passages, 'w1').map((p) => p.id)).toEqual(['a', 'c'])
  })
})

describe('workProgress', () => {
  it('按篇统计：复习过一次即算已背，段数只用于显示', () => {
    const w = work('w1', '论语', reviewedToday())
    const passages = [
      passage('a', 'w1', 0, { audioId: 'x' }),
      passage('b', 'w1', 1),
      passage('c', 'w1', 2, { isRecite: false }),
    ]
    const progress = workProgress(w, passages, TODAY)
    expect(progress.total).toBe(3)
    expect(progress.reciteCount).toBe(2)
    expect(progress.reviewedCount).toBe(2)
    expect(progress.reviewedTotal).toBe(1)
    expect(progress.audioCount).toBe(1)
    expect(progress.dueCount).toBe(0)
    expect(progress.mastery).toBeGreaterThan(0)
  })
})

describe('overallStats（口径按篇）', () => {
  it('待复习与已完成都数篇，段数另算', () => {
    const works = [work('w1', '论语'), work('w2', '道德经'), work('w3', '岳阳楼记', reviewedToday())]
    const passages = [
      passage('a', 'w1', 0),
      passage('b', 'w1', 1),
      passage('c', 'w2', 0, { isRecite: false }),
      passage('d', 'w3', 0),
    ]
    const stats: DailyStat[] = [
      {
        date: TODAY,
        reviewedCount: 1,
        ratings: { blank: 0, hard: 0, rusty: 0, fluent: 1 },
        workIds: ['w3'],
        checkedIn: false,
        updatedAt: 0,
      },
    ]
    const result = overallStats(works, passages, TODAY, stats)
    expect(result.totalWorks).toBe(3)
    expect(result.reciteWorks).toBe(2) // w3 已复习过，明天才到期；w2 没有要背的段
    expect(result.dueWorks).toBe(1)
    expect(result.duePassages).toBe(2)
    expect(result.reviewedToday).toBe(1)
    expect(result.totalReviews).toBe(1)
    expect(result.startedWorks).toBe(1)
    expect(result.bandCounts.new).toBe(1)
  })
})

describe('passagesOfWork', () => {
  it('按 order 排序返回', () => {
    const passages = [passage('b', 'w1', 1), passage('a', 'w1', 0)]
    expect(passagesOfWork(passages, 'w1').map((p) => p.id)).toEqual(['a', 'b'])
  })
})
