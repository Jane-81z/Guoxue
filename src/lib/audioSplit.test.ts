import { describe, expect, it } from 'vitest'
import { computeEnvelope, mixToMono, splitBySilence } from './audioSplit'

/** 造一段测试音频：tone 秒有声、silence 秒静音，交替拼接 */
function synthesize(parts: { seconds: number; loud: boolean }[], sampleRate = 8000) {
  const total = Math.round(parts.reduce((sum, part) => sum + part.seconds, 0) * sampleRate)
  const samples = new Float32Array(total)
  let cursor = 0
  for (const part of parts) {
    const length = Math.round(part.seconds * sampleRate)
    for (let i = 0; i < length; i += 1) {
      // 有声部分用 200Hz 方波，模拟响亮的朗读；静音部分给一点点底噪
      samples[cursor + i] = part.loud ? (Math.floor(i / 20) % 2 === 0 ? 0.6 : -0.6) : 0.0004
    }
    cursor += length
  }
  return samples
}

describe('computeEnvelope', () => {
  it('按窗长压成包络，时长正确', () => {
    const samples = synthesize([{ seconds: 1, loud: true }])
    const envelope = computeEnvelope(samples, 8000, 20)
    expect(envelope.durationMs).toBeCloseTo(1000, 0)
    expect(envelope.rms.length).toBe(50)
    expect(envelope.rms[0]).toBeGreaterThan(0.5)
  })

  it('静音窗的 RMS 接近 0', () => {
    const samples = synthesize([
      { seconds: 0.5, loud: true },
      { seconds: 2.5, loud: false },
    ])
    const envelope = computeEnvelope(samples, 8000, 20)
    expect(envelope.rms[envelope.rms.length - 1]).toBeLessThan(0.01)
  })
})

describe('mixToMono', () => {
  it('多声道取平均', () => {
    const mono = mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])])
    expect(Array.from(mono)).toEqual([0.5, 0.5])
  })
})

describe('splitBySilence（停顿 ≥2 秒即分段）', () => {
  it('两处 2.5 秒停顿切成 3 段', () => {
    const samples = synthesize([
      { seconds: 1, loud: true },
      { seconds: 2.5, loud: false },
      { seconds: 1, loud: true },
      { seconds: 2.5, loud: false },
      { seconds: 1, loud: true },
    ])
    const result = splitBySilence(computeEnvelope(samples, 8000))
    expect(result.segments).toHaveLength(3)
    expect(result.cuts).toHaveLength(2)
    // 第一刀落在第一段静音中间（约 2.25 秒）
    expect(result.cuts[0]).toBeGreaterThan(2100)
    expect(result.cuts[0]).toBeLessThan(2400)
  })

  it('只有 1.5 秒的停顿不切（阈值是 2 秒）', () => {
    const samples = synthesize([
      { seconds: 1, loud: true },
      { seconds: 1.5, loud: false },
      { seconds: 1, loud: true },
    ])
    const result = splitBySilence(computeEnvelope(samples, 8000))
    expect(result.segments).toHaveLength(1)
    expect(result.cuts).toHaveLength(0)
    // 但仍然会被列为「静音」，只是不够长
    expect(result.silences).toHaveLength(0)
  })

  it('阈值可调：把门槛降到 1 秒，同样的停顿就会切', () => {
    const samples = synthesize([
      { seconds: 1, loud: true },
      { seconds: 1.5, loud: false },
      { seconds: 1, loud: true },
    ])
    const result = splitBySilence(computeEnvelope(samples, 8000), { minSilenceSeconds: 1 })
    expect(result.segments).toHaveLength(2)
  })

  it('连续朗读（没有停顿）不切', () => {
    const samples = synthesize([{ seconds: 3, loud: true }])
    const result = splitBySilence(computeEnvelope(samples, 8000))
    expect(result.segments).toHaveLength(1)
    expect(result.cuts).toHaveLength(0)
  })

  it('太短的碎片不会单独成段', () => {
    const samples = synthesize([
      { seconds: 1, loud: true },
      { seconds: 2.5, loud: false },
      { seconds: 0.05, loud: true },
      { seconds: 2.5, loud: false },
      { seconds: 1, loud: true },
    ])
    const result = splitBySilence(computeEnvelope(samples, 8000))
    // 中间那 50ms 的碎片被丢掉，只剩两段
    expect(result.segments).toHaveLength(2)
  })

  it('空音频不报错', () => {
    const result = splitBySilence(computeEnvelope(new Float32Array(0), 8000))
    expect(result.segments).toHaveLength(0)
    expect(result.cuts).toHaveLength(0)
  })
})
