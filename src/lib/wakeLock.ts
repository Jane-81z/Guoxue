/**
 * 播放时的屏幕常亮锁（Screen Wake Lock）。
 *
 * iOS 16.4+ 支持；更老的系统上没有这个 API，acquire 会安静地返回 false。
 * 它只能防「自动熄屏」——用户主动按锁屏键、切到别的 App 时，系统照样会挂起 PWA。
 */

export interface WakeLockSentinelLike {
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

export interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

export interface ScreenWakeLock {
  /** 申请常亮；已持有或系统不支持时不会重复申请。返回是否真的持有 */
  acquire: () => Promise<boolean>
  /** 释放常亮；重复调用安全 */
  release: () => Promise<void>
  /** 当前是否持有 */
  held: () => boolean
}

export function createScreenWakeLock(nav: WakeLockNavigator | undefined): ScreenWakeLock {
  let sentinel: WakeLockSentinelLike | null = null
  let pending: Promise<WakeLockSentinelLike | null> | null = null
  // 用来处理「申请还没回来就先释放」的竞态
  let generation = 0

  async function acquire(): Promise<boolean> {
    if (sentinel) return true
    const api = nav?.wakeLock
    if (!api) return false
    const mine = generation
    if (!pending) {
      pending = api.request('screen').catch(() => null)
    }
    const next = await pending
    if (mine === generation) pending = null
    if (!next) return false
    // 并发申请拿到的是同一条锁，别把它当成多余的再释放掉
    if (sentinel === next) return true
    if (mine !== generation || sentinel) {
      void next.release().catch(() => undefined)
      return false
    }
    sentinel = next
    next.addEventListener?.('release', () => {
      if (sentinel === next) sentinel = null
    })
    return true
  }

  async function release(): Promise<void> {
    generation += 1
    const current = sentinel
    sentinel = null
    pending = null
    if (!current) return
    try {
      await current.release()
    } catch {
      // 页面隐藏时系统可能已经先释放了
    }
  }

  return { acquire, release, held: () => sentinel !== null }
}
