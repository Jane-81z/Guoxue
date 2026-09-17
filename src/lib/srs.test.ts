import { describe, expect, it } from 'vitest'
import {
  EASE_MAX,
  EASE_MIN,
  MASTERED_THRESHOLD,
  createSrsState,
  isDue,
  masteryBand,
  masteryScore,
  schedule,
} from './srs'

const TODAY = '2026-09-17'

describe('createSrsState', () => {
  it('新卡默认 ease 2.5、到期日为当天、未复习', () => {
    const srs = createSrsState(TODAY)
    expect(srs.ease).toBe(2.5)
    expect(srs.dueAt).toBe(TODAY)
    expect(srs.history).toEqual([])
    expect(isDue(srs, TODAY)).toBe(true)
  })
})

describe('schedule 四档评分', () => {
  it('完全不会：重复归零，间隔回到 1 天，到期为明天', () => {
    let srs = createSrsState(TODAY)
    srs = schedule(srs, 'fluent', TODAY)
    srs = schedule(srs, 'fluent', '2026-09-18')
    expect(srs.repetitions).toBe(2)
    const reset = schedule(srs, 'blank', '2026-09-24')
    expect(reset.repetitions).toBe(0)
    expect(reset.intervalDays).toBe(1)
    expect(reset.dueAt).toBe('2026-09-25')
    expect(reset.ease).toBeLessThan(srs.ease)
  })

  it('吃力（q=3）视为通过但会压低 ease', () => {
    const srs = schedule(createSrsState(TODAY), 'hard', TODAY)
    expect(srs.repetitions).toBe(1)
    expect(srs.intervalDays).toBe(1)
    expect(srs.ease).toBeCloseTo(2.36, 2)
  })

  it('略有卡顿（q=4）ease 几乎不变', () => {
    const srs = schedule(createSrsState(TODAY), 'rusty', TODAY)
    expect(srs.ease).toBeCloseTo(2.5, 2)
  })

  it('流畅（q=5）提升 ease', () => {
    const srs = schedule(createSrsState(TODAY), 'fluent', TODAY)
    expect(srs.ease).toBeCloseTo(2.6, 2)
  })

  it('间隔推进：1 天 → 6 天 → interval × ease', () => {
    let srs = createSrsState(TODAY)
    srs = schedule(srs, 'fluent', TODAY)
    expect(srs.intervalDays).toBe(1)
    expect(srs.dueAt).toBe('2026-09-18')

    srs = schedule(srs, 'fluent', '2026-09-18')
    expect(srs.intervalDays).toBe(6)
    expect(srs.dueAt).toBe('2026-09-24')

    srs = schedule(srs, 'fluent', '2026-09-24')
    expect(srs.intervalDays).toBe(Math.round(6 * srs.ease))
    expect(srs.repetitions).toBe(3)
  })

  it('ease 被夹在 1.3 – 2.8', () => {
    let low = createSrsState(TODAY)
    for (let i = 0; i < 20; i += 1) low = schedule(low, 'hard', TODAY)
    expect(low.ease).toBeGreaterThanOrEqual(EASE_MIN)

    let high = createSrsState(TODAY)
    for (let i = 0; i < 20; i += 1) high = schedule(high, 'fluent', TODAY)
    expect(high.ease).toBeLessThanOrEqual(EASE_MAX)
  })

  it('history 追加记录', () => {
    const srs = schedule(createSrsState(TODAY), 'rusty', TODAY)
    expect(srs.history).toEqual([{ date: TODAY, rating: 'rusty' }])
    expect(srs.lastReviewedAt).toBe(TODAY)
    expect(srs.lastRating).toBe('rusty')
  })
})

describe('masteryScore', () => {
  it('新卡为 0', () => {
    expect(masteryScore(createSrsState(TODAY))).toBe(0)
  })

  it('取值落在 0 – 100，且随间隔增长', () => {
    let srs = createSrsState(TODAY)
    const scores: number[] = []
    for (let i = 0; i < 8; i += 1) {
      srs = schedule(srs, 'fluent', '2026-09-17')
      const score = masteryScore(srs)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
      scores.push(score)
    }
    expect(scores[0]).toBeLessThan(scores[scores.length - 1])
  })

  it('评分差会体现在熟练度上', () => {
    let good = createSrsState(TODAY)
    let bad = createSrsState(TODAY)
    for (let i = 0; i < 4; i += 1) {
      good = schedule(good, 'fluent', TODAY)
      bad = schedule(bad, 'blank', TODAY)
    }
    expect(masteryScore(good)).toBeGreaterThan(masteryScore(bad))
  })

  it('熟练度分档', () => {
    expect(masteryBand(0).key).toBe('new')
    expect(masteryBand(10).key).toBe('learning')
    expect(masteryBand(50).key).toBe('familiar')
    expect(masteryBand(MASTERED_THRESHOLD).key).toBe('mastered')
  })
})

describe('isDue', () => {
  it('到期日当天与逾期都算待复习', () => {
    const srs = { ...createSrsState('2026-09-20'), history: [{ date: TODAY, rating: 'fluent' as const }] }
    expect(isDue(srs, '2026-09-19')).toBe(false)
    expect(isDue(srs, '2026-09-20')).toBe(true)
    expect(isDue(srs, '2026-09-25')).toBe(true)
  })
})
