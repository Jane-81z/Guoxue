import { describe, expect, it } from 'vitest'
import { describePlan, planMatch } from './match'
import { createSrsState } from './srs'
import type { Passage } from '../types'

function makePassage(id: string, order: number, text: string, extras: Partial<Passage> = {}): Passage {
  return {
    id,
    workId: 'w1',
    order,
    text,
    isRecite: true,
    pinyinOverrides: {},
    pinyinCache: null,
    note: '',
    audioId: null,
    srs: createSrsState('2026-09-17'),
    createdAt: 0,
    updatedAt: 0,
    ...extras,
  }
}

describe('planMatch', () => {
  const base = [
    makePassage('a', 0, '甲'),
    makePassage('b', 1, '乙'),
    makePassage('c', 2, '丙'),
  ]

  it('文本不变时全部保留且无变化', () => {
    const plan = planMatch(base, ['甲', '乙', '丙'])
    expect(plan.kept.map((k) => k.passageId)).toEqual(['a', 'b', 'c'])
    expect(plan.added).toHaveLength(0)
    expect(plan.removed).toHaveLength(0)
    expect(plan.changed).toBe(false)
  })

  it('新增一行只新增该行', () => {
    const plan = planMatch(base, ['甲', '乙', '新', '丙'])
    expect(plan.kept.map((k) => k.passageId)).toEqual(['a', 'b', 'c'])
    expect(plan.added).toEqual([{ text: '新', newOrder: 2 }])
    expect(plan.kept.find((k) => k.passageId === 'c')?.newOrder).toBe(3)
    expect(plan.changed).toBe(true)
  })

  it('删除一行会丢弃该段进度，并标记出来', () => {
    const withData = base.map((p) =>
      p.id === 'b' ? { ...p, audioId: 'audio-1', srs: { ...p.srs, history: [{ date: '2026-09-17', rating: 'fluent' as const }] } } : p,
    )
    const plan = planMatch(withData, ['甲', '丙'])
    expect(plan.removed.map((p) => p.id)).toEqual(['b'])
    expect(plan.removedWithData.map((p) => p.id)).toEqual(['b'])
    expect(plan.kept.map((k) => k.passageId)).toEqual(['a', 'c'])
    expect(describePlan(plan)).toContain('删除 1 段')
    expect(describePlan(plan)).toContain('不可恢复')
  })

  it('调整顺序时进度跟着文本走', () => {
    const plan = planMatch(base, ['丙', '甲', '乙'])
    expect(plan.kept.map((k) => [k.passageId, k.newOrder])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ])
  })

  it('重复行按出现顺序一一对应', () => {
    const dup = [makePassage('d1', 0, '同'), makePassage('d2', 1, '同')]
    const plan = planMatch(dup, ['同', '同', '同'])
    expect(plan.kept.map((k) => k.passageId)).toEqual(['d1', 'd2'])
    expect(plan.added).toHaveLength(1)
  })

  it('忽略首尾空白后再比较', () => {
    const plan = planMatch(base, ['  甲  ', '乙', '丙'])
    expect(plan.kept).toHaveLength(3)
    expect(plan.removed).toHaveLength(0)
    expect(plan.kept[0].text).toBe('  甲  ')
  })
})
