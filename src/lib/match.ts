import type { Passage } from '../types'

export interface KeptPlan {
  passageId: string
  text: string
  newOrder: number
  oldOrder: number
}

export interface AddedPlan {
  text: string
  newOrder: number
}

export interface MatchPlan {
  kept: KeptPlan[]
  added: AddedPlan[]
  removed: Passage[]
  /** 被删除且带复习进度或录音的段落，需要重点提示 */
  removedWithData: Passage[]
  changed: boolean
}

const normalize = (text: string): string => text.trim()

/**
 * 按行文本内容匹配新旧段落：
 * 文本相同的段落保留其录音与复习进度（重复行按出现顺序一一对应），
 * 新行建立新段，消失的行丢弃其进度与录音。
 */
export function planMatch(oldPassages: Passage[], newLines: string[]): MatchPlan {
  const buckets = new Map<string, Passage[]>()
  for (const passage of [...oldPassages].sort((a, b) => a.order - b.order)) {
    const key = normalize(passage.text)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(passage)
    else buckets.set(key, [passage])
  }

  const kept: KeptPlan[] = []
  const added: AddedPlan[] = []
  const used = new Set<string>()

  newLines.forEach((line, index) => {
    const bucket = buckets.get(normalize(line))
    const passage = bucket && bucket.length ? bucket.shift() : undefined
    if (passage) {
      used.add(passage.id)
      kept.push({
        passageId: passage.id,
        text: line,
        newOrder: index,
        oldOrder: passage.order,
      })
    } else {
      added.push({ text: line, newOrder: index })
    }
  })

  const removed = oldPassages
    .filter((p) => !used.has(p.id))
    .sort((a, b) => a.order - b.order)
  const removedWithData = removed.filter((p) => p.srs.history.length > 0 || p.audioId !== null)
  const changed =
    added.length > 0 ||
    removed.length > 0 ||
    kept.some((k) => k.newOrder !== k.oldOrder) ||
    kept.some((k) => {
      const old = oldPassages.find((p) => p.id === k.passageId)
      return !!old && old.text !== k.text
    })

  return { kept, added, removed, removedWithData, changed }
}

export function describePlan(plan: MatchPlan): string {
  const parts: string[] = []
  if (plan.kept.length) parts.push(`保留 ${plan.kept.length} 段（录音与进度不变）`)
  if (plan.added.length) parts.push(`新增 ${plan.added.length} 段`)
  if (plan.removed.length) parts.push(`删除 ${plan.removed.length} 段`)
  if (plan.removedWithData.length)
    parts.push(`其中 ${plan.removedWithData.length} 段带复习进度或录音，删除后不可恢复`)
  return parts.join('，')
}
