/**
 * 开发用：把 decision 目录里的示意图内联进 payload 的 comp 槽位。
 * 决策页的本地服务不提供文件读取（探针 404），所以用 data URI 传图。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const mocks = join(here, '..', 'mocks', 'decision')

const MAP = {
  assigned: 'assigned.png',
  'model-pick': 'model-pick.png',
  'signals-instruments-seven-segment-alarm-clock': 'seven-segment.png',
  'medium-native-hypercard-stack-shoebox': 'hypercard.png',
  canon: 'canon.png',
}

function dataUri(file) {
  const buf = readFileSync(join(mocks, file))
  return `data:image/png;base64,${buf.toString('base64')}`
}

const payload = JSON.parse(readFileSync(join(here, 'payload.json'), 'utf8'))
let embedded = 0

for (const option of payload.options) {
  const file = MAP[option.id]
  if (!file || option.verdict === 'declined') continue
  option.comp = dataUri(file)
  embedded += 1
}
if (payload.canonCard) {
  payload.canonCard.comp = dataUri(MAP.canon)
  embedded += 1
}

const out = join(here, 'payload.comps.json')
writeFileSync(out, JSON.stringify(payload, null, 2))
console.log(`embedded ${embedded} comps -> ${out} (${(readFileSync(out).length / 1024).toFixed(0)} KB)`)
