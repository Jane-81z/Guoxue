import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECITE_PACE,
  PER_PASSAGE_OVERHEAD_SECONDS,
  clampPace,
  countRecitableChars,
  estimateMinutes,
  formatEstimate,
  passageSeconds,
  readoutDigits,
  sessionSeconds,
} from './estimate'
import type { Passage } from '../types'

function passage(id: string, text: string): Passage {
  return {
    id,
    workId: 'w1',
    order: 0,
    text,
    isRecite: true,
    pinyinOverrides: {},
    pinyinCache: null,
    note: '',
    audioId: null,
    srs: {
      ease: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueAt: '2026-09-17',
      lastRating: null,
      lastReviewedAt: null,
      history: [],
    },
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('countRecitableChars', () => {
  it('只数要读出来的字，标点与空白不算', () => {
    // 子曰 学而时习之 不亦说乎 = 11 个字，四个标点不计
    expect(countRecitableChars('子曰：学而时习之，不亦说乎？')).toBe(11)
  })

  it('空文本与纯标点为 0', () => {
    expect(countRecitableChars('')).toBe(0)
    expect(countRecitableChars('，。！？')).toBe(0)
  })
})

describe('passageSeconds', () => {
  it('无录音时按字数与速度估算，并加上固定开销', () => {
    const text = '甲'.repeat(150)
    expect(passageSeconds(text, null, 150)).toBe(60 + PER_PASSAGE_OVERHEAD_SECONDS)
    expect(passageSeconds(text, null, 120)).toBe(75 + PER_PASSAGE_OVERHEAD_SECONDS)
  })

  it('有录音时以录音长度为准并上浮 15%', () => {
    expect(passageSeconds('任意文本', 60_000)).toBe(Math.round(60 * 1.15) + PER_PASSAGE_OVERHEAD_SECONDS)
  })

  it('速度为 0 或非法时回落到默认速度', () => {
    const text = '乙'.repeat(150)
    expect(passageSeconds(text, null, 0)).toBe(passageSeconds(text, null, DEFAULT_RECITE_PACE))
    expect(passageSeconds(text, null, Number.NaN)).toBe(
      passageSeconds(text, null, DEFAULT_RECITE_PACE),
    )
  })
})

describe('clampPace', () => {
  it('夹在 120–200 之间', () => {
    expect(clampPace(90)).toBe(120)
    expect(clampPace(999)).toBe(200)
    expect(clampPace(165)).toBe(165)
  })
})

describe('sessionSeconds', () => {
  it('把今日剩余段落相加', () => {
    const items = [passage('a', '甲'.repeat(150)), passage('b', '乙'.repeat(75))]
    const total = sessionSeconds(items, new Map(), 150)
    expect(total).toBe(60 + PER_PASSAGE_OVERHEAD_SECONDS + 30 + PER_PASSAGE_OVERHEAD_SECONDS)
  })

  it('有录音的段落用录音时长', () => {
    const items = [passage('a', '丙'.repeat(10))]
    const total = sessionSeconds(items, new Map([['a', 20_000]]), 150)
    expect(total).toBe(Math.round(20 * 1.15) + PER_PASSAGE_OVERHEAD_SECONDS)
  })
})

describe('读数格式', () => {
  it('分钟向上取整', () => {
    expect(estimateMinutes(0)).toBe(0)
    expect(estimateMinutes(1)).toBe(1)
    expect(estimateMinutes(61)).toBe(2)
  })

  it('两位读数', () => {
    expect(readoutDigits(6)).toBe('06')
    expect(readoutDigits(120)).toBe('99')
  })

  it('人话描述', () => {
    expect(formatEstimate(0)).toBe('今天没有要背的')
    expect(formatEstimate(30)).toBe('不到 1 分钟')
    expect(formatEstimate(360)).toBe('约 6 分钟')
    expect(formatEstimate(3660)).toBe('约 1 小时 1 分')
    expect(formatEstimate(7200)).toBe('约 2 小时')
  })
})
