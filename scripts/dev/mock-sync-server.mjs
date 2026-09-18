/**
 * 开发用：内存版同步服务，行为与 Cloudflare Pages Function 一致，
 * 让端到端测试能在本地验证「两台设备用同一个同步码对起来」。
 * 用法：node scripts/dev/mock-sync-server.mjs [端口]
 */
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 4190)
const store = new Map()
const CODE_RE = /^[A-Z0-9]{8,64}$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
}

function json(res, status, data) {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end()
    return
  }

  // 供 Playwright 的 webServer 就绪检查使用
  if (url.pathname === '/health') {
    json(res, 200, { ok: true, codes: store.size })
    return
  }

  if (url.pathname !== '/api/sync') {
    json(res, 404, { error: 'not_found' })
    return
  }

  if (req.method === 'GET') {
    const code = (url.searchParams.get('code') || '').toUpperCase()
    if (!CODE_RE.test(code)) return json(res, 400, { error: 'bad_code' })
    const value = store.get(code)
    if (!value) return json(res, 404, { error: 'not_found' })
    res.writeHead(200, { ...CORS, 'content-type': 'application/json; charset=utf-8' })
    res.end(value)
    return
  }

  if (req.method === 'PUT') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 2 * 1024 * 1024) req.destroy()
    })
    req.on('end', () => {
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch {
        return json(res, 400, { error: 'bad_json' })
      }
      const code = String(parsed?.code || '').toUpperCase()
      if (!CODE_RE.test(code)) return json(res, 400, { error: 'bad_code' })
      if (!parsed?.payload || typeof parsed.payload !== 'object') {
        return json(res, 400, { error: 'bad_payload' })
      }
      store.set(code, JSON.stringify(parsed.payload))
      json(res, 200, { ok: true, bytes: body.length })
    })
    return
  }

  json(res, 405, { error: 'method_not_allowed' })
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`mock sync server on http://localhost:${port}/api/sync\n`)
})
