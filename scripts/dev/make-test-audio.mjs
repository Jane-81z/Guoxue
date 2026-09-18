/**
 * 开发用：生成端到端测试用的 WAV —— 三段朗读、每段之间静音 2.5 秒。
 * 8kHz 单声道 16bit，约 128KB，足以让切分算法稳定识别出两处停顿。
 * 用法：node scripts/dev/make-test-audio.mjs [输出路径]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const out = resolve(process.argv[2] ?? 'e2e/fixtures/three-segments.wav')
const sampleRate = 8000

const parts = [
  { seconds: 1.0, loud: true },
  { seconds: 2.5, loud: false },
  { seconds: 1.0, loud: true },
  { seconds: 2.5, loud: false },
  { seconds: 1.0, loud: true },
]

const totalSamples = Math.round(parts.reduce((sum, part) => sum + part.seconds, 0) * sampleRate)
const data = Buffer.alloc(totalSamples * 2)
let cursor = 0
let phase = 0
for (const part of parts) {
  const length = Math.round(part.seconds * sampleRate)
  for (let i = 0; i < length; i += 1) {
    // 有声段：440Hz 正弦；静音段：极低底噪（约 -68dB）
    const value = part.loud ? Math.sin(phase) * 0.6 : 0.0004
    phase += (2 * Math.PI * 440) / sampleRate
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value * 32767))), (cursor + i) * 2)
  }
  cursor += length
}

const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(1, 22) // mono
header.writeUInt32LE(sampleRate, 24)
header.writeUInt32LE(sampleRate * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, Buffer.concat([header, data]))
process.stdout.write(
  `wrote ${out} · ${(totalSamples / sampleRate).toFixed(1)}s · ${((44 + data.length) / 1024).toFixed(0)}KB\n`,
)
