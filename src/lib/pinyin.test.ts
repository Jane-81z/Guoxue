import { describe, expect, it } from 'vitest'
import { annotatePinyin, buildPinyinCache, isHanzi, plainPinyin, resolveTokens } from './pinyin'

describe('annotatePinyin', () => {
  it('逐字注音，标点不带拼音', () => {
    const tokens = annotatePinyin('学而时习之，不亦说乎？')
    expect(tokens.map((t) => t.char).join('')).toBe('学而时习之，不亦说乎？')
    expect(tokens.find((t) => t.char === '，')?.pinyin).toBeNull()
    expect(tokens.find((t) => t.char === '学')?.pinyin).toBe('xué')
  })

  it('多音字按上下文取音（论语 vs 讨论）', () => {
    const lunyu = annotatePinyin('论语')[0]
    const taolun = annotatePinyin('讨论')[1]
    expect(lunyu.pinyin).toBe('lún')
    expect(taolun.pinyin).toBe('lùn')
  })

  it('人工修正优先于自动注音', () => {
    const tokens = annotatePinyin('子曰', { '0': 'zǐ' })
    expect(tokens[0].pinyin).toBe('zǐ')
    expect(tokens[1].pinyin).toBe('yuē')
  })

  it('罗马数字与英文不注音', () => {
    const tokens = annotatePinyin('ABC第一')
    expect(tokens[0].pinyin).toBeNull()
    expect(tokens[3].pinyin).toBe('dì')
  })

  it('isHanzi 只认汉字', () => {
    expect(isHanzi('医')).toBe(true)
    expect(isHanzi('，')).toBe(false)
    expect(isHanzi('A')).toBe(false)
  })

  it('plainPinyin 生成可读注音串', () => {
    expect(plainPinyin(annotatePinyin('子曰'))).toBe('zǐ yuē')
  })
})

describe('resolveTokens', () => {
  it('缓存与实时计算一致，并可叠加修正', () => {
    const text = '有朋自远方来'
    const cache = buildPinyinCache(text)
    const auto = resolveTokens(text, cache, {})
    expect(auto.map((t) => t.pinyin).join(' ')).toBe('yǒu péng zì yuǎn fāng lái')
    const fixed = resolveTokens(text, cache, { '0': 'yòu' })
    expect(fixed[0].pinyin).toBe('yòu')
  })

  it('缓存长度不符时回退到实时计算', () => {
    const tokens = resolveTokens('甲乙', JSON.stringify([{ index: 0, char: '甲', pinyin: 'jiǎ' }]), {})
    expect(tokens).toHaveLength(2)
    expect(tokens[1].char).toBe('乙')
  })
})
