/**
 * 开发用：GitHub Gist API 的内存替身，只实现同步用到的那四个接口，
 * 让端到端测试能在本地验证「两端用同一个令牌对上同一份 Gist」。
 * 用法：node scripts/dev/mock-github-server.mjs [端口]
 */
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 4191)
const gists = new Map()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,accept,x-github-api-version',
  'Access-Control-Max-Age': '86400',
}

function json(res, status, data) {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
  })
}

function nextId() {
  return `gist${String(gists.size + 1).padStart(4, '0')}aaaaaaaaaaaaaaaaaaaaaaaaaaaa`
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end()
    return
  }

  if (url.pathname === '/health') {
    json(res, 200, { ok: true, gists: gists.size })
    return
  }

  const authHeader = req.headers.authorization || ''
  // 专门用来测「令牌过期」这条失败路径
  if (authHeader === 'Bearer expired-token') {
    json(res, 401, { message: 'Bad credentials' })
    return
  }
  const authed = authHeader.startsWith('Bearer ')
  if (!authed) {
    json(res, 401, { message: 'Requires authentication' })
    return
  }

  if (url.pathname === '/gists' && req.method === 'GET') {
    // 列表接口不返回文件内容（与 GitHub 行为一致）
    json(
      res,
      200,
      [...gists.values()].map((gist) => ({
        id: gist.id,
        description: gist.description,
        files: Object.fromEntries(Object.keys(gist.files).map((name) => [name, {}])),
        updated_at: gist.updated_at,
      })),
    )
    return
  }

  if (url.pathname === '/gists' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const id = nextId()
    const gist = {
      id,
      description: body.description ?? null,
      files: body.files ?? {},
      updated_at: new Date().toISOString(),
    }
    gists.set(id, gist)
    json(res, 201, gist)
    return
  }

  const match = url.pathname.match(/^\/gists\/([^/]+)$/)
  if (match) {
    const gist = gists.get(match[1])
    if (!gist) {
      json(res, 404, { message: 'Not Found' })
      return
    }
    if (req.method === 'GET') {
      json(res, 200, gist)
      return
    }
    if (req.method === 'PATCH') {
      const body = JSON.parse((await readBody(req)) || '{}')
      for (const [name, file] of Object.entries(body.files ?? {})) {
        if (file.content === undefined || file.content === '') delete gist.files[name]
        else gist.files[name] = { content: file.content }
      }
      gist.updated_at = new Date().toISOString()
      json(res, 200, gist)
      return
    }
  }

  json(res, 404, { message: 'Not Found' })
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`mock github api on http://localhost:${port}\n`)
})
