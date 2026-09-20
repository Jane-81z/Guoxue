import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPayload, type SyncPayload } from './syncMerge'
import { GIST_FILE, readGist } from './syncGist'

const API = 'https://api.github.com'

const payload: SyncPayload = buildPayload({
  works: [],
  passages: [],
  dailyStats: [],
  tombstones: {},
})

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** 装一个只认这几条地址的 fetch */
function stubFetch(
  routes: Record<string, (init?: RequestInit) => Response>,
  calls: string[] = [],
): string[] {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input)
      calls.push(url)
      const route = routes[url]
      if (!route) throw new Error(`未预期的请求：${url}`)
      return route(init)
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Gist 读取', () => {
  it('正常文件直接解析', async () => {
    stubFetch({
      [`${API}/gists/g1`]: () =>
        jsonResponse({
          id: 'g1',
          description: null,
          files: { [GIST_FILE]: { content: JSON.stringify(payload), truncated: false } },
        }),
    })
    const result = await readGist(API, 'tok', 'g1')
    expect(result?.schemaVersion).toBe(payload.schemaVersion)
  })

  it('超过 1 MB 被 GitHub 截断时，自动改读 raw_url 拿全文', async () => {
    const half = JSON.stringify(payload).slice(0, 12)
    const calls = stubFetch({
      [`${API}/gists/g1`]: () =>
        jsonResponse({
          id: 'g1',
          description: null,
          files: {
            [GIST_FILE]: {
              content: half,
              truncated: true,
              size: 2 * 1024 * 1024,
              raw_url: 'https://gist.githubusercontent.com/raw/g1',
            },
          },
        }),
      'https://gist.githubusercontent.com/raw/g1': () =>
        new Response(JSON.stringify(payload), { status: 200 }),
    })

    const result = await readGist(API, 'tok', 'g1')

    expect(result?.schemaVersion).toBe(payload.schemaVersion)
    expect(calls).toEqual([`${API}/gists/g1`, 'https://gist.githubusercontent.com/raw/g1'])
  })

  it('截断又没有 raw_url 时给出人话，不甩 JSON.parse 原文', async () => {
    stubFetch({
      [`${API}/gists/g1`]: () =>
        jsonResponse({
          id: 'g1',
          description: null,
          files: { [GIST_FILE]: { content: '{"schemaVersion":1,', truncated: true } },
        }),
    })
    await expect(readGist(API, 'tok', 'g1')).rejects.toThrow(/1 MB/)
  })

  it('内容半截（没标 truncated）时给的是重试提示', async () => {
    stubFetch({
      [`${API}/gists/g1`]: () =>
        jsonResponse({
          id: 'g1',
          description: null,
          files: { [GIST_FILE]: { content: '{"schemaVersion":1,"works":[', truncated: false } },
        }),
    })
    await expect(readGist(API, 'tok', 'g1')).rejects.toThrow(/半截/)
  })

  it('云端还没有这份数据时返回 null', async () => {
    stubFetch({ [`${API}/gists/g1`]: () => jsonResponse({ message: 'Not Found' }, 404) })
    await expect(readGist(API, 'tok', 'g1')).resolves.toBeNull()
  })

  it('令牌无效时提示换令牌', async () => {
    stubFetch({ [`${API}/gists/g1`]: () => jsonResponse({ message: 'Bad credentials' }, 401) })
    await expect(readGist(API, 'bad', 'g1')).rejects.toThrow(/令牌/)
  })
})
