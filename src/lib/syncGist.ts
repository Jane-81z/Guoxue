import { DEFAULT_GITHUB_API } from './syncConfig'
import { isPayload, type SyncPayload } from './syncMerge'

/** 用一个 secret Gist 当云端：整份数据放在这一个文件里 */
export const GIST_FILE = 'guoxue-sync.json'
/** 靠这个描述认领「我们自己的那个 Gist」，这样第二台设备只需要令牌 */
export const GIST_MARKER = 'guoxue-recitation-sync'

interface GistFile {
  content?: string
  truncated?: boolean
}

interface Gist {
  id: string
  description: string | null
  files: Record<string, GistFile>
}

async function github(
  api: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${api || DEFAULT_GITHUB_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (res.status === 401) throw new Error('GitHub 令牌无效或已过期')
  if (res.status === 403) throw new Error('GitHub 拒绝了请求：权限不足或触发限流')
  return res
}

/** 找到我们自己的那个 Gist（按描述），没有则返回 null */
export async function findGist(api: string, token: string): Promise<string | null> {
  const res = await github(api, token, '/gists?per_page=100')
  if (!res.ok) throw new Error(`GitHub 读取列表失败（${res.status}）`)
  const list = (await res.json()) as Gist[]
  const mine = list.find((gist) => gist.description === GIST_MARKER)
  return mine?.id ?? null
}

export async function createGist(
  api: string,
  token: string,
  payload: SyncPayload,
): Promise<string> {
  const res = await github(api, token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_MARKER,
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(payload) } },
    }),
  })
  if (!res.ok) throw new Error(`创建云端存储失败（${res.status}）`)
  const gist = (await res.json()) as Gist
  return gist.id
}

export async function readGist(
  api: string,
  token: string,
  gistId: string,
): Promise<SyncPayload | null> {
  const res = await github(api, token, `/gists/${gistId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`云端读取失败（${res.status}）`)
  const gist = (await res.json()) as Gist
  const file = gist.files?.[GIST_FILE]
  if (!file?.content) return null
  const parsed: unknown = JSON.parse(file.content)
  if (!isPayload(parsed)) throw new Error('云端数据格式不认识')
  return parsed
}

export async function writeGist(
  api: string,
  token: string,
  gistId: string,
  payload: SyncPayload,
): Promise<void> {
  const res = await github(api, token, `/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(payload) } } }),
  })
  if (!res.ok) throw new Error(`云端写入失败（${res.status}）`)
}
