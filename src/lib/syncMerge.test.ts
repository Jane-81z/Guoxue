import { describe, expect, it } from 'vitest'
import {
  SYNC_SCHEMA_VERSION,
  TOMBSTONE_TTL_MS,
  buildPayload,
  emptyPayload,
  isPayload,
  mergePayloads,
  type SyncPayload,
} from './syncMerge'
import type { DailyStat, Passage, Work } from '../types'

const NOW = 1_700_000_000_000

function work(id: string, title: string, updatedAt: number): Work {
  return { id, title, tags: [], createdAt: 0, updatedAt }
}

function passage(id: string, text: string, updatedAt: number): Passage {
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
      dueAt: '2026-09-18',
      lastRating: null,
      lastReviewedAt: null,
      history: [],
    },
    createdAt: 0,
    updatedAt,
  }
}

function stat(date: string, reviewedCount: number, updatedAt: number): DailyStat {
  return {
    date,
    reviewedCount,
    ratings: { blank: 0, hard: 0, rusty: 0, fluent: 0 },
    workIds: [],
    checkedIn: false,
    updatedAt,
  }
}

function payload(parts: Partial<SyncPayload>): SyncPayload {
  return { ...emptyPayload(NOW), ...parts }
}

describe('mergePayloads', () => {
  it('远端为空时原样返回本地', () => {
    const result = mergePayloads(payload({ works: [work('w1', '论语', 10)] }), null, NOW)
    expect(result.payload.works).toHaveLength(1)
    expect(result.pulledIn).toBe(0)
  })

  it('两台设备各自新增的条目会合并到一起', () => {
    const result = mergePayloads(
      payload({ works: [work('w1', '论语', 10)] }),
      payload({ works: [work('w2', '道德经', 20)] }),
      NOW,
    )
    expect(result.payload.works.map((w) => w.id).sort()).toEqual(['w1', 'w2'])
    expect(result.pulledIn).toBe(1)
  })

  it('同一条被两边改过时取最后修改更晚的那份', () => {
    const remoteWins = mergePayloads(
      payload({ passages: [passage('p1', '本地版本', 100)] }),
      payload({ passages: [passage('p1', '远端更新版本', 200)] }),
      NOW,
    )
    expect(remoteWins.payload.passages[0].text).toBe('远端更新版本')

    const localWins = mergePayloads(
      payload({ passages: [passage('p1', '本地更新版本', 300)] }),
      payload({ passages: [passage('p1', '远端旧版本', 200)] }),
      NOW,
    )
    expect(localWins.payload.passages[0].text).toBe('本地更新版本')
  })

  it('墓碑能阻止已删除的条目被另一端同步回来', () => {
    const result = mergePayloads(
      payload({ tombstones: { w1: 80 } }),
      payload({ works: [work('w1', '已删掉的篇目', 50)] }),
      NOW,
    )
    expect(result.payload.works).toHaveLength(0)
  })

  it('删除之后又重建的同一条（修改更晚）应当保留', () => {
    const result = mergePayloads(
      payload({ tombstones: { w1: 80 } }),
      payload({ works: [work('w1', '重新建的同一条', 120)] }),
      NOW,
    )
    expect(result.payload.works).toHaveLength(1)
  })

  it('合并可交换：两端各算一次会收敛到同一结果', () => {
    const a = payload({ works: [work('w1', '甲', 10)], tombstones: { w9: 30 } })
    const b = payload({
      works: [work('w2', '乙', 20), work('w1', '甲改', 40)],
      tombstones: { w8: 50 },
    })
    const ab = mergePayloads(a, b, NOW).payload
    const ba = mergePayloads(b, a, NOW).payload
    expect(ab.works.map((w) => `${w.id}:${w.title}`).sort()).toEqual(
      ba.works.map((w) => `${w.id}:${w.title}`).sort(),
    )
    expect(Object.keys(ab.tombstones).sort()).toEqual(Object.keys(ba.tombstones).sort())
  })

  it('每日统计也按最后修改时间合并', () => {
    const result = mergePayloads(
      payload({ dailyStats: [stat('2026-09-18', 3, 10)] }),
      payload({ dailyStats: [stat('2026-09-18', 5, 20)] }),
      NOW,
    )
    expect(result.payload.dailyStats[0].reviewedCount).toBe(5)
  })

  it('过期墓碑会被清理，避免无限增长', () => {
    const result = mergePayloads(
      payload({ tombstones: { old: NOW - TOMBSTONE_TTL_MS - 1, fresh: NOW - 1000 } }),
      null,
      NOW,
    )
    expect(result.payload.tombstones).toEqual({ fresh: NOW - 1000 })
  })
})

describe('buildPayload / isPayload', () => {
  it('打包带上 schema 版本与时间', () => {
    const built = buildPayload({ works: [], passages: [], dailyStats: [], tombstones: {} }, NOW)
    expect(built.schemaVersion).toBe(SYNC_SCHEMA_VERSION)
    expect(built.savedAt).toBe(NOW)
  })

  it('能挡住不成形的载荷', () => {
    expect(isPayload({})).toBe(false)
    expect(isPayload(null)).toBe(false)
    expect(isPayload('nope')).toBe(false)
    expect(isPayload(emptyPayload(NOW))).toBe(true)
  })
})
