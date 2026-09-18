/**
 * 云同步接口（Cloudflare Pages Function）。
 * 它是「哑」存储：按同步码读写整份 JSON，合并逻辑在客户端（src/lib/syncMerge.ts），
 * 这样两端各自算一次也会收敛到同一份数据。
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
}

/** 同步码：大写字母与数字，8–64 位 */
const CODE_RE = /^[A-Z0-9]{8,64}$/
/** 单份载荷上限：只有文本、拼音、注释与进度，正常只有几十 KB */
const MAX_BYTES = 2 * 1024 * 1024

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  if (request.method === 'GET') {
    const code = (new URL(request.url).searchParams.get('code') || '').toUpperCase()
    if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)
    const value = await env.GUOXUE_SYNC.get(`sync:${code}`)
    if (!value) return json({ error: 'not_found' }, 404)
    return new Response(value, {
      status: 200,
      headers: {
        ...CORS,
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  if (request.method === 'PUT') {
    const body = await request.text()
    if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413)
    let parsed
    try {
      parsed = JSON.parse(body)
    } catch {
      return json({ error: 'bad_json' }, 400)
    }
    const code = String(parsed?.code || '').toUpperCase()
    if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)
    if (!parsed?.payload || typeof parsed.payload !== 'object') return json({ error: 'bad_payload' }, 400)
    await env.GUOXUE_SYNC.put(`sync:${code}`, JSON.stringify(parsed.payload))
    return json({ ok: true, bytes: body.length }, 200)
  }

  return json({ error: 'method_not_allowed' }, 405)
}
