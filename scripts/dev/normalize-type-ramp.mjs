/**
 * 一次性归一：把 1px 一跳的字面字号收进真正的字阶。
 * 映射：9→10、12→13、14→15、16→17、19→20、44→42（其余保持）
 * 只改 text-[Npx] 这一种写法，不动 Tailwind 的语义字号类。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MAP = { '9px': '10px', '12px': '13px', '14px': '15px', '16px': '17px', '19px': '20px', '44px': '42px' }
const root = process.argv[2] ?? 'src'
const exts = ['.tsx', '.ts', '.css']
let changed = 0
let files = 0

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (!exts.some((ext) => entry.endsWith(ext))) continue
    const before = readFileSync(full, 'utf8')
    const after = before.replace(/text-\[(\d+)px\]/g, (match, n) => {
      const mapped = MAP[`${n}px`]
      return mapped ? `text-[${mapped}]` : match
    })
    if (after !== before) {
      writeFileSync(full, after)
      files += 1
      changed += (before.match(/text-\[(\d+)px\]/g) ?? []).filter((m) => MAP[m.slice(6, -1)]).length
    }
  }
}

walk(root)
process.stdout.write(`normalized ${changed} size(s) across ${files} file(s)\n`)
