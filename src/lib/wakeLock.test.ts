import { describe, expect, it, vi } from 'vitest'
import { createScreenWakeLock, type WakeLockSentinelLike } from './wakeLock'

function fakeNavigator() {
  const sentinels: WakeLockSentinelLike[] = []
  const releaseListeners: Array<() => void> = []
  let requests = 0
  const nav = {
    wakeLock: {
      request: vi.fn(async () => {
        requests += 1
        const sentinel: WakeLockSentinelLike = {
          release: vi.fn(async () => {
            const index = sentinels.indexOf(sentinel)
            if (index >= 0) sentinels.splice(index, 1)
          }),
          addEventListener: (_type: 'release', listener: () => void) => {
            releaseListeners.push(listener)
          },
        }
        sentinels.push(sentinel)
        return sentinel
      }),
    },
  }
  return {
    nav,
    sentinels,
    get requests() {
      return requests
    },
    systemRelease(sentinel: WakeLockSentinelLike) {
      const index = sentinels.indexOf(sentinel)
      if (index >= 0) sentinels.splice(index, 1)
      for (const listener of releaseListeners) listener()
    },
  }
}

describe('createScreenWakeLock', () => {
  it('申请一次并保持常亮，重复申请不会再多要一条', async () => {
    const fake = fakeNavigator()
    const lock = createScreenWakeLock(fake.nav)
    await expect(lock.acquire()).resolves.toBe(true)
    await expect(lock.acquire()).resolves.toBe(true)
    expect(fake.requests).toBe(1)
    expect(lock.held()).toBe(true)
  })

  it('释放之后可以再次申请', async () => {
    const fake = fakeNavigator()
    const lock = createScreenWakeLock(fake.nav)
    await lock.acquire()
    await lock.release()
    expect(lock.held()).toBe(false)
    await lock.acquire()
    expect(fake.requests).toBe(2)
    expect(lock.held()).toBe(true)
  })

  it('系统主动释放（例如切到后台）后，状态跟着变，并能重新申请', async () => {
    const fake = fakeNavigator()
    const lock = createScreenWakeLock(fake.nav)
    await lock.acquire()
    fake.systemRelease(fake.sentinels[0])
    expect(lock.held()).toBe(false)
    await lock.acquire()
    expect(fake.requests).toBe(2)
  })

  it('不支持 Wake Lock 的环境安静地返回 false，不抛错', async () => {
    const lock = createScreenWakeLock(undefined)
    await expect(lock.acquire()).resolves.toBe(false)
    await expect(lock.release()).resolves.toBeUndefined()
  })

  it('系统拒绝申请时不抛错', async () => {
    const lock = createScreenWakeLock({
      wakeLock: { request: async () => Promise.reject(new Error('not allowed')) },
    })
    await expect(lock.acquire()).resolves.toBe(false)
    expect(lock.held()).toBe(false)
  })

  it('申请还没回来就释放：回来后立刻把锁放掉，不留悬挂', async () => {
    const holder: { resolve?: (sentinel: WakeLockSentinelLike) => void } = {}
    const sentinel = { release: vi.fn(async () => undefined) }
    const lock = createScreenWakeLock({
      wakeLock: {
        request: () =>
          new Promise<WakeLockSentinelLike>((resolve) => {
            holder.resolve = resolve
          }),
      },
    })
    const pending = lock.acquire()
    await lock.release()
    holder.resolve?.(sentinel)
    await expect(pending).resolves.toBe(false)
    expect(sentinel.release).toHaveBeenCalledTimes(1)
    expect(lock.held()).toBe(false)
  })
})
