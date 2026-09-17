import { describe, expect, it } from 'vitest'
import { joinPassages, splitPassages } from './split'

describe('splitPassages', () => {
  it('按单换行切分，丢弃空行与首尾空白', () => {
    expect(splitPassages('子曰：学而时习之\n\n  有朋自远方来  \n')).toEqual([
      '子曰：学而时习之',
      '有朋自远方来',
    ])
  })

  it('兼容 CRLF 与 CR', () => {
    expect(splitPassages('甲\r\n乙\r丙')).toEqual(['甲', '乙', '丙'])
  })

  it('空文本返回空数组', () => {
    expect(splitPassages('')).toEqual([])
    expect(splitPassages('   \n  \n')).toEqual([])
  })

  it('不会按句号或标点切分', () => {
    expect(splitPassages('一句。二句。')).toEqual(['一句。二句。'])
  })

  it('joinPassages 是 splitPassages 的逆操作', () => {
    const lines = ['第一段', '第二段']
    expect(splitPassages(joinPassages(lines))).toEqual(lines)
  })
})
