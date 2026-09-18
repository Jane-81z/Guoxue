import { create } from 'zustand'
import type { PlayMode } from '../types'
import { getAudioBlob } from '../db/repo'
import { useAppStore } from './useAppStore'

interface PlayerState {
  queue: string[]
  workId: string | null
  index: number
  currentPassageId: string | null
  /** 当前段在整篇音频里的区间（秒）；没有区间时 clipStart=0、clipEnd=null */
  clipStart: number
  clipEnd: number | null
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  rate: number
  repeatCount: number
  mode: PlayMode
  playCount: number
  error: string | null

  loadWork: (workId: string, passageIds: string[], startPassageId?: string) => void
  playPassage: (passageId: string) => Promise<void>
  toggle: () => void
  pause: () => void
  resume: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setRate: (rate: number) => void
  setRepeatCount: (count: number) => void
  setMode: (mode: PlayMode) => void
  stop: () => void
  clearError: () => void
}

let audioEl: HTMLAudioElement | null = null
const urlCache = new Map<string, string>()
let lastPositionSave = 0

function releaseUrl(audioId: string) {
  const url = urlCache.get(audioId)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(audioId)
  }
}

function urlFor(audioId: string, blob: Blob): string {
  const cached = urlCache.get(audioId)
  if (cached) return cached
  if (urlCache.size >= 30) {
    const oldest = urlCache.keys().next().value
    if (oldest) releaseUrl(oldest)
  }
  const url = URL.createObjectURL(blob)
  urlCache.set(audioId, url)
  return url
}

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.preload = 'metadata'
  }
  return audioEl
}

function loadSource(audio: HTMLAudioElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('error', onError)
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('音频无法播放，可能格式不受支持'))
    }
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('error', onError)
    audio.src = url
    audio.load()
  })
}

function persistPlayerState() {
  const app = useAppStore.getState()
  const player = app.settings.player
  void app.updateSettings({
    player: {
      ...player,
      rate: usePlayerStore.getState().rate,
      repeatCount: usePlayerStore.getState().repeatCount,
      mode: usePlayerStore.getState().mode,
    },
  })
}

function savePosition(force = false) {
  const state = usePlayerStore.getState()
  const passageId = state.currentPassageId
  const workId = state.workId
  if (!passageId) return
  const now = Date.now()
  if (!force && now - lastPositionSave < 5000) return
  lastPositionSave = now
  const app = useAppStore.getState()
  const player = app.settings.player
  void app.updateSettings({
    player: {
      ...player,
      positions: { ...player.positions, [passageId]: Math.round(state.currentTime) },
      lastPlayed: workId ? { ...player.lastPlayed, [workId]: passageId } : player.lastPlayed,
    },
  })
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  queue: [],
  workId: null,
  index: 0,
  currentPassageId: null,
  clipStart: 0,
  clipEnd: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  rate: 1,
  repeatCount: 1,
  mode: 'sequence',
  playCount: 0,
  error: null,

  loadWork: (workId, passageIds, startPassageId) => {
    const app = useAppStore.getState()
    const start =
      startPassageId ??
      app.settings.player.lastPlayed[workId] ??
      passageIds[0] ??
      null
    const index = start ? Math.max(0, passageIds.indexOf(start)) : 0
    set({
      workId,
      queue: passageIds,
      index,
      currentPassageId: start,
      clipStart: 0,
      clipEnd: null,
      currentTime: start ? app.settings.player.positions[start] ?? 0 : 0,
      duration: 0,
      playCount: 0,
    })
  },

  playPassage: async (passageId) => {
    const app = useAppStore.getState()
    const passage = app.passages.find((p) => p.id === passageId)
    if (!passage) return
    const queue = get().queue.includes(passageId) ? get().queue : [passageId]
    const index = Math.max(0, queue.indexOf(passageId))
    const clipStart = (passage.audioStartMs ?? 0) / 1000
    const clipEnd = passage.audioEndMs != null ? passage.audioEndMs / 1000 : null
    set({
      queue,
      index,
      currentPassageId: passageId,
      clipStart,
      clipEnd,
      playCount: 0,
      error: null,
    })

    if (!passage.audioId) {
      set({ error: '这一段还没有录音', isPlaying: false })
      return
    }
    set({ isLoading: true })
    try {
      const blob = await getAudioBlob(passage.audioId)
      if (!blob) throw new Error('录音数据缺失')
      const audio = getAudio()
      const url = urlFor(passage.audioId, blob)
      if (audio.src !== url) await loadSource(audio, url)
      audio.playbackRate = get().rate
      // 位置按「段内相对时间」保存，避免整篇音频里各段互相干扰
      const saved = app.settings.player.positions[passageId] ?? 0
      const clipLength = (clipEnd ?? audio.duration) - clipStart
      if (saved > 3 && Number.isFinite(clipLength) && saved < clipLength - 3) {
        audio.currentTime = clipStart + saved
      } else {
        audio.currentTime = clipStart
      }
      await audio.play()
      set({
        isPlaying: true,
        isLoading: false,
        duration: Number.isFinite(clipLength) ? clipLength : 0,
        currentTime: Math.max(0, audio.currentTime - clipStart),
        error: null,
      })
      if (get().workId) savePosition(true)
    } catch (err) {
      set({
        isLoading: false,
        isPlaying: false,
        error: err instanceof Error ? err.message : '播放失败',
      })
    }
  },

  toggle: () => {
    const { isPlaying, currentPassageId } = get()
    if (!currentPassageId) return
    if (isPlaying) get().pause()
    else get().resume()
  },

  pause: () => {
    const audio = getAudio()
    audio.pause()
    set({ isPlaying: false })
    savePosition(true)
  },

  resume: () => {
    const audio = getAudio()
    if (!get().currentPassageId) return
    void audio
      .play()
      .then(() => set({ isPlaying: true, error: null }))
      .catch((err: unknown) =>
        set({ error: err instanceof Error ? err.message : '播放失败', isPlaying: false }),
      )
  },

  next: () => {
    const { queue, index } = get()
    if (!queue.length) return
    const nextIndex = index + 1 < queue.length ? index + 1 : 0
    void get().playPassage(queue[nextIndex])
  },

  prev: () => {
    const { queue, index, currentTime } = get()
    if (!queue.length) return
    const audio = getAudio()
    if (currentTime > 4) {
      audio.currentTime = get().clipStart
      set({ currentTime: 0 })
      return
    }
    const prevIndex = index - 1 >= 0 ? index - 1 : queue.length - 1
    void get().playPassage(queue[prevIndex])
  },

  seek: (time) => {
    const audio = getAudio()
    const { clipStart, clipEnd } = get()
    const limit = clipEnd != null ? clipEnd - clipStart : audio.duration - clipStart
    const relative = Math.max(0, Math.min(time, Number.isFinite(limit) ? limit : time))
    audio.currentTime = clipStart + relative
    set({ currentTime: relative })
  },

  setRate: (rate) => {
    const audio = getAudio()
    audio.playbackRate = rate
    set({ rate })
    persistPlayerState()
  },

  setRepeatCount: (count) => {
    set({ repeatCount: count, playCount: 0 })
    persistPlayerState()
  },

  setMode: (mode) => {
    set({ mode })
    persistPlayerState()
  },

  stop: () => {
    const audio = getAudio()
    audio.pause()
    audio.removeAttribute('src')
    set({ isPlaying: false, currentTime: 0, duration: 0 })
  },

  clearError: () => set({ error: null }),
}))

function handleEnded() {
  const state = usePlayerStore.getState()
  const audio = getAudio()
  if (state.repeatCount > 1 && state.playCount + 1 < state.repeatCount) {
    usePlayerStore.setState({ playCount: state.playCount + 1 })
    audio.currentTime = state.clipStart
    void audio.play()
    return
  }
  usePlayerStore.setState({ playCount: 0 })
  if (state.mode === 'repeatOne') {
    audio.currentTime = state.clipStart
    void audio.play()
    return
  }
  const nextIndex = state.index + 1
  if (nextIndex < state.queue.length) {
    void state.playPassage(state.queue[nextIndex])
    return
  }
  if (state.mode === 'repeatAll' && state.queue.length) {
    void state.playPassage(state.queue[0])
    return
  }
  savePosition(true)
  usePlayerStore.setState({ isPlaying: false, currentTime: 0 })
}

function setupAudioListeners() {
  const audio = getAudio()
  audio.addEventListener('timeupdate', () => {
    const { clipStart, clipEnd } = usePlayerStore.getState()
    const relative = Math.max(0, audio.currentTime - clipStart)
    usePlayerStore.setState({ currentTime: relative })
    // 整篇音频里的某一段：播到区间末尾就算这一段结束
    if (clipEnd != null && audio.currentTime >= clipEnd - 0.05) {
      audio.pause()
      handleEnded()
      return
    }
    savePosition(false)
  })
  audio.addEventListener('durationchange', () => {
    const { clipStart, clipEnd } = usePlayerStore.getState()
    const length = (clipEnd ?? audio.duration) - clipStart
    if (Number.isFinite(length)) usePlayerStore.setState({ duration: length })
  })
  audio.addEventListener('play', () => usePlayerStore.setState({ isPlaying: true }))
  audio.addEventListener('pause', () => usePlayerStore.setState({ isPlaying: false }))
  audio.addEventListener('ended', handleEnded)
  audio.addEventListener('error', () => {
    if (!audio.src) return
    usePlayerStore.setState({ error: '播放中断，可能格式不受支持', isPlaying: false })
  })
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume())
      navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause())
      navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().prev())
      navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().next())
    } catch {
      // 部分浏览器不支持，忽略
    }
  }
}

setupAudioListeners()

/** 同步当前播放曲目的锁屏信息 */
export function updateMediaSession(title: string, artist: string) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: '国学背诵',
    })
    navigator.mediaSession.playbackState = usePlayerStore.getState().isPlaying ? 'playing' : 'paused'
  } catch {
    // 忽略
  }
}
