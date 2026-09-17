/**
 * 开发用：在本地彩排 GitHub Pages 的环境，验证子路径 + 404 回落。
 * 把 dist 复制成 <root>/Guoxue/，按 Pages 的规则服务：找不到文件时返回 404.html（状态码 404）。
 * 用法：node scripts/dev/preview-pages.mjs [端口]
 */
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 4180)
const root = resolve('.impeccable/tmp/pages-rehearsal')
const site = join(root, 'Guoxue')

if (existsSync(root)) rmSync(root, { recursive: true, force: true })
mkdirSync(site, { recursive: true })
cpSync('dist', site, { recursive: true })

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  let path = decodeURIComponent(url.pathname)
  if (path.endsWith('/')) path += 'index.html'
  const file = join(root, path)

  if (existsSync(file) && !file.endsWith('/')) {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
    return
  }

  // GitHub Pages 的行为：未知路径返回 404.html，状态码 404
  const fallback = join(site, '404.html')
  if (existsSync(fallback)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(readFileSync(fallback))
    return
  }
  res.writeHead(404).end('not found')
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`GitHub Pages 彩排：http://localhost:${port}/Guoxue/\n`)
})
