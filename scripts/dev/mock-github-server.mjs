/**
 * 开发用：GitHub Gist API 的内存替身，只实现同步用到的那四个接口，
 * 让端到端测试能在本地验证「两端用同一个令牌对上同一份 Gist」。
 * 用法：node scripts/dev/mock-github-server.mjs [端口]
 */
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 4191)
const gists = new Map()
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** GitHub 对 Gist 里单个文件的返回上限：超过就只给前 1 MB，并置 truncated=true */
const DEFAULT_TRUNCATE_BYTES = 1024 * 1024
let truncateBytes = DEFAULT_TRUNCATE_BYTES

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

// 按字节截断，模拟 GitHub 只返回前 N 字节的行为：
// 得到的是半截 JSON，真实环境的 JSON.parse 会在这里报「字符串未终止」
function truncateByBytes(content) {
  const full = encoder.encode(content)
  if (full.length <= truncateBytes) return { content, truncated: false, size: full.length }
  return {
    content: decoder.decode(full.slice(0, truncateBytes)),
    truncated: true,
    size: full.length,
  }
}

/** 读单个 Gist 时文件的样子：带 truncated / raw_url / size */
function fileForResponse(name, file, gistId) {
  const { content, truncated, size } = truncateByBytes(file.content ?? '')
  return {
    [name]: {
      filename: name,
      type: 'application/json',
      language: 'JSON',
      size,
      truncated,
      content,
      raw_url: `http://127.0.0.1:${port}/raw/${gistId}/${encodeURIComponent(name)}`,
    },
  }
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

  // 测试钩子：调截断线（默认 1 MB）
  if (url.pathname === '/test/truncate-limit' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    truncateBytes = Number(body.bytes) > 0 ? Number(body.bytes) : DEFAULT_TRUNCATE_BYTES
    json(res, 200, { bytes: truncateBytes })
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
  const token = authHeader.slice('Bearer '.length)

  // 测试钩子：读回云端那份文件的实际内容（用来断言上传时已经去掉注音缓存）
  if (url.pathname === '/test/file' && req.method === 'GET') {
    const mine = [...gists.values()].find((gist) => gist.token === token)
    json(res, 200, { content: mine?.files?.['guoxue-sync.json']?.content ?? null })
    return
  }

  if (url.pathname === '/gists' && req.method === 'GET') {
    // 列表接口不返回文件内容（与 GitHub 行为一致）；替身按令牌隔离，免得用例之间互相串
    json(
      res,
      200,
      [...gists.values()]
        .filter((gist) => gist.token === token)
        .map((gist) => ({
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
      token,
      updated_at: new Date().toISOString(),
    }
    gists.set(id, gist)
    json(res, 201, gist)
    return
  }

  // raw_url 指向这里：原样全文，不截断
  const rawMatch = url.pathname.match(/^\/raw\/([^/]+)\/(.+)$/)
  if (rawMatch && req.method === 'GET') {
    const gist = gists.get(rawMatch[1])
    const file = gist?.files?.[decodeURIComponent(rawMatch[2])]
    if (!file) {
      json(res, 404, { message: 'Not Found' })
      return
    }
    res.writeHead(200, { ...CORS, 'content-type': 'text/plain; charset=utf-8' })
    res.end(file.content ?? '')
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
      json(res, 200, {
        id: gist.id,
        description: gist.description,
        updated_at: gist.updated_at,
        files: Object.assign(
          {},
          ...Object.entries(gist.files).map(([name, file]) =>
            fileForResponse(name, file, gist.id),
          ),
        ),
      })
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
