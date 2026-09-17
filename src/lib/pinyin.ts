import { pinyin } from 'pinyin-pro'
import type { RubyToken } from '../types'

const HANZI_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}]/u

export function isHanzi(ch: string): boolean {
  return HANZI_RE.test(ch)
}

/**
 * 逐字注音。连续的汉字合并成一段送进 pinyin-pro，保证多音字按上下文取音
 * （如「论语」lún yǔ）。非汉字（标点、数字）pinyin 为 null。
 * overrides 的键是「码点序号」，人工修正优先于自动注音。
 */
export function annotatePinyin(text: string, overrides: Record<string, string> = {}): RubyToken[] {
  const chars = Array.from(text)
  const tokens: RubyToken[] = []
  let i = 0

  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      tokens.push({ index: i, char: chars[i], pinyin: null })
      i += 1
      continue
    }
    let j = i
    while (j < chars.length && isHanzi(chars[j])) j += 1
    const run = chars.slice(i, j).join('')
    let readings: string[] = []
    try {
      readings = pinyin(run, { toneType: 'symbol', type: 'array' }) as string[]
    } catch {
      readings = []
    }
    for (let k = 0; k < j - i; k += 1) {
      tokens.push({ index: i + k, char: chars[i + k], pinyin: readings[k] ?? null })
    }
    i = j
  }

  return tokens.map((token) => {
    const override = overrides[String(token.index)]
    return override ? { ...token, pinyin: override } : token
  })
}

/** 生成可持久化的注音缓存 */
export function buildPinyinCache(text: string): string {
  return JSON.stringify(annotatePinyin(text))
}

const cachePool = new Map<string, RubyToken[]>()

/** 读取注音缓存并叠加人工修正，带内存级 memo */
export function resolveTokens(
  text: string,
  pinyinCache: string | null,
  overrides: Record<string, string>,
): RubyToken[] {
  const key = `${pinyinCache ?? ''}\u0000${text}`
  let base = cachePool.get(key)
  if (!base) {
    if (pinyinCache) {
      try {
        const parsed = JSON.parse(pinyinCache) as RubyToken[]
        if (Array.isArray(parsed) && parsed.length && parsed.length === Array.from(text).length) {
          base = parsed
        }
      } catch {
        base = undefined
      }
    }
    base = base ?? annotatePinyin(text)
    if (cachePool.size > 400) cachePool.clear()
    cachePool.set(key, base)
  }
  if (!overrides || Object.keys(overrides).length === 0) return base
  return base.map((token) => {
    const override = overrides[String(token.index)]
    return override ? { ...token, pinyin: override } : token
  })
}

/** 仅保留可注音的字，用于拼音编辑面板 */
export function editableTokens(tokens: RubyToken[]): RubyToken[] {
  return tokens.filter((t) => isHanzi(t.char))
}

export function plainPinyin(tokens: RubyToken[]): string {
  const parts: string[] = []
  for (const t of tokens) {
    if (t.pinyin) parts.push(t.pinyin)
    else if (t.char.trim()) parts.push(t.char)
  }
  return parts.join(' ')
}
