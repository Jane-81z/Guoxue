/**
 * 生成 PWA 图标（纯 Node，不依赖原生库）。
 * 画面属于「日课刻度」这个世界：哑光近黑地 + 发光段码
 * ——上面两段点亮（红），第三段只亮左半边、其余保持幽灵态。
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public')
mkdirSync(outDir, { recursive: true })

const GROUND = [0x0b, 0x0d, 0x10]
const LIT = [0xff, 0x2e, 0x1f]
const LIT_GHOST = [0x3a, 0x1b, 0x18]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function blend(target, offset, color, alpha) {
  if (alpha <= 0) return
  for (let c = 0; c < 3; c += 1) {
    target[offset + c] = Math.round(target[offset + c] * (1 - alpha) + color[c] * alpha)
  }
  target[offset + 3] = Math.round(target[offset + 3] * (1 - alpha) + 255 * alpha)
}

/** 圆角矩形覆盖率（3×3 超采样抗锯齿） */
function roundedRectCoverage(px, py, rect, samples = 3) {
  let hits = 0
  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      const x = px + (sx + 0.5) / samples
      const y = py + (sy + 0.5) / samples
      const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w))
      const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h))
      const r = rect.r
      if (Math.hypot(dx, dy) <= r) hits += 1
    }
  }
  return hits / (samples * samples)
}

function renderIcon(size, { padding = 0.14 } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const scale = 1 - padding * 2

  // 近黑地
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      blend(rgba, (y * size + x) * 4, GROUND, 1)
    }
  }

  // 所有几何都换算成像素单位，覆盖率采样才落在正确的子像素上
  const px = (v) => v * size
  const barX = padding + 0.19 * scale
  const barW = 0.62 * scale
  const barH = 0.085 * scale
  const radius = 0.042 * scale
  const barYs = [0.235, 0.425, 0.615].map((y) => padding + y * scale)

  const segments = [
    { x: px(barX), y: px(barYs[0]), w: px(barW), h: px(barH), r: px(radius), color: LIT, glow: true },
    { x: px(barX), y: px(barYs[1]), w: px(barW), h: px(barH), r: px(radius), color: LIT, glow: true },
    // 第三段：整条先是幽灵态，只有左半边点亮
    {
      x: px(barX),
      y: px(barYs[2]),
      w: px(barW),
      h: px(barH),
      r: px(radius),
      color: LIT_GHOST,
      glow: false,
    },
    {
      x: px(barX),
      y: px(barYs[2]),
      w: px(barW * 0.46),
      h: px(barH),
      r: px(radius),
      color: LIT,
      glow: true,
    },
  ]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      for (const segment of segments) {
        if (segment.glow) {
          // 发光是这个世界的光源，不是描边：向外几圈递减的红色晕
          for (let ring = 3; ring >= 1; ring -= 1) {
            const spread = (px(barH) * ring) / 2.2
            const halo = {
              x: segment.x - spread,
              y: segment.y - spread,
              w: segment.w + spread * 2,
              h: segment.h + spread * 2,
              r: segment.r + spread,
            }
            blend(rgba, offset, LIT, roundedRectCoverage(x, y, halo) * 0.1)
          }
        }
        const coverage = roundedRectCoverage(x, y, segment)
        if (coverage > 0) blend(rgba, offset, segment.color, coverage)
      }
    }
  }

  return encodePng(size, size, rgba)
}

const targets = [
  { file: 'pwa-192.png', size: 192, padding: 0.12 },
  { file: 'pwa-512.png', size: 512, padding: 0.12 },
  { file: 'pwa-512-maskable.png', size: 512, padding: 0.24 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.12 },
]

for (const target of targets) {
  const png = renderIcon(target.size, { padding: target.padding })
  writeFileSync(resolve(outDir, target.file), png)
  console.log(`generated public/${target.file} (${png.length} bytes)`)
}
