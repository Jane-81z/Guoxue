/** 开发用：正确解码 PNG（含行过滤器）后给出尺寸、色彩数与亮度，用于核对截图不是空白/错图 */
import { readFileSync, readdirSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'E:/codex/reading/.impeccable/review'

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function decode(file) {
  const buf = readFileSync(file)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colorType = buf[25]
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (!bpp) throw new Error(`unsupported colorType ${colorType}`)

  let off = 8
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.slice(off + 4, off + 8).toString('ascii')
    if (type === 'IDAT') idat.push(buf.slice(off + 8, off + 8 + len))
    if (type === 'IEND') break
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))

  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  let p = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]
    p += 1
    const rowStart = y * stride
    const prevStart = (y - 1) * stride
    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[p + x]
      const a = x >= bpp ? out[rowStart + x - bpp] : 0
      const b = y > 0 ? out[prevStart + x] : 0
      const c = y > 0 && x >= bpp ? out[prevStart + x - bpp] : 0
      let value
      if (filter === 0) value = rawByte
      else if (filter === 1) value = rawByte + a
      else if (filter === 2) value = rawByte + b
      else if (filter === 3) value = rawByte + ((a + b) >> 1)
      else if (filter === 4) value = rawByte + paeth(a, b, c)
      else throw new Error(`unknown filter ${filter} on row ${y}`)
      out[rowStart + x] = value & 0xff
    }
    p += stride
  }
  return { width, height, bpp, pixels: out }
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
  const { width, height, bpp, pixels } = decode(join(dir, file))
  const colors = new Map()
  let sum = 0
  let count = 0
  let dark = 0
  for (let y = 0; y < height; y += 5) {
    for (let x = 0; x < width; x += 5) {
      const o = (y * width + x) * bpp
      const key = `${pixels[o]},${pixels[o + 1]},${pixels[o + 2]}`
      colors.set(key, (colors.get(key) ?? 0) + 1)
      const lum = 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]
      sum += lum
      count += 1
      if (lum < 40) dark += 1
    }
  }
  const top = [...colors.entries()].sort((a, b) => b[1] - a[1])[0]
  process.stdout.write(
    `${file.padEnd(26)} ${width}x${height}  distinct=${String(colors.size).padStart(4)}  meanLum=${(sum / count).toFixed(1)}  dark=${((dark / count) * 100).toFixed(0)}%  dominant=${top[0]} (${((top[1] / count) * 100).toFixed(0)}%)\n`,
  )
}
