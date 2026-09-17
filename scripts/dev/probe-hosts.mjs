/**
 * 实测：常见静态托管默认域名在这条网络上「解析是否被污染 + 443 是否真能连」。
 * 用法：node scripts/dev/probe-hosts.mjs [domain ...]
 */
import { connect } from 'node:net'
import { resolve4 } from 'node:dns/promises'

const META_HINTS = [/^31\.13\./, /^2a03:2880/, /^128\.242\.240/, /^243\.185\./, /^59\.24\./]

const domains = process.argv.slice(2)
if (domains.length === 0) {
  domains.push(
    'guoxue-six.vercel.app',
    'vercel.app',
    'example.pages.dev',
    'example.netlify.app',
    'example.github.io',
    'example.web.app',
    'example.edgeone.app',
    'example.workers.dev',
    'example.deno.dev',
    'example.onrender.com',
    'example.surge.sh',
    'www.baidu.com',
  )
}

function tcp(host, port = 443, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    const done = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeout)
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false))
    socket.on('error', () => done(false))
  })
}

for (const domain of domains) {
  let ips = []
  let note = ''
  try {
    ips = await resolve4(domain)
  } catch (err) {
    note = `解析失败（${err.code ?? err.message}）`
  }
  const poisoned = ips.some((ip) => META_HINTS.some((re) => re.test(ip)))
  const reachable = ips.length ? await tcp(ips[0]) : false
  process.stdout.write(
    `${domain.padEnd(30)} ip=${(ips[0] ?? '-').padEnd(16)} ${poisoned ? '疑似污染' : '解析正常'}  443=${reachable ? '通' : '不通'} ${note}\n`,
  )
}
