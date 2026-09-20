/**
 * 麦克风录音：浏览器原生 getUserMedia + MediaRecorder。
 *
 * 录出来的东西是一个普通 File，和从「文件」App 选进来的 m4a 完全同构，
 * 所以后面解码、切分、落库那一整条链路一行都不用改。
 * 全在本机进行，不联网、不上传。
 */

/** 64 kbps ≈ 0.46 MB/分钟，比语音备忘录默认省一半 */
export const RECORDER_BITRATE = 64000

export interface RecorderSupport {
  supported: boolean
  reason?: string
}

export function checkRecorderSupport(): RecorderSupport {
  if (typeof window === 'undefined') return { supported: false, reason: '当前环境不支持录音' }
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    return { supported: false, reason: '录音需要 https 打开（当前不是安全上下文）' }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: '这个浏览器没有给网页麦克风权限的接口' }
  }
  if (typeof MediaRecorder === 'undefined') {
    return { supported: false, reason: '这个浏览器不支持录音（iOS 需要 14.5 以上）' }
  }
  return { supported: true }
}

/**
 * 挑一个能用的录制容器。Safari 只给 audio/mp4，Chrome 给 webm，
 * 顺序按「先选不转码就能播的」排。
 */
export function pickRecorderMime(isTypeSupported: (type: string) => boolean): string {
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
  ]
  return candidates.find((type) => isTypeSupported(type)) ?? ''
}

export function extensionForMime(mime: string): string {
  const value = mime.toLowerCase()
  if (value.includes('mp4') || value.includes('aac') || value.includes('m4a')) return 'm4a'
  if (value.includes('webm')) return 'webm'
  if (value.includes('ogg')) return 'ogg'
  if (value.includes('wav')) return 'wav'
  return 'm4a'
}

/** 权限相关的失败最常见，逐条给一句能照着做的话 */
export function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '麦克风权限被拒绝了：到「设置 → Safari → 麦克风」允许，或先用「选文件」导入'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '这台设备上没找到麦克风'
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '麦克风被别的 App 占着，先关掉它再试'
  }
  if (err instanceof Error && err.message) return `无法开始录音：${err.message}`
  return '无法开始录音'
}

export interface RecordingHandle {
  /** 0–1 的瞬时电平，用于画电平条 */
  level(): number
  stop(): Promise<File>
  cancel(): void
}

interface WakeLockSentinel {
  release: () => Promise<void>
}

export async function startRecording(fileBaseName: string): Promise<RecordingHandle> {
  const support = checkRecorderSupport()
  if (!support.supported) throw new Error(support.reason)

  // AudioContext 必须在点击手势里同步建出来，否则 iOS 会把它置为 suspended
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const context = Ctor ? new Ctor() : null
  if (context?.state === 'suspended') void context.resume()

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch (err) {
    void context?.close()
    throw new Error(describeMicError(err))
  }

  const mime = pickRecorderMime((type) => MediaRecorder.isTypeSupported(type))
  let recorder: MediaRecorder
  try {
    recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: RECORDER_BITRATE })
      : new MediaRecorder(stream, { audioBitsPerSecond: RECORDER_BITRATE })
  } catch {
    // 个别系统不认这些选项，退回默认设置也比录不成强
    recorder = new MediaRecorder(stream)
  }

  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data?.size) chunks.push(event.data)
  })

  // 电平表：AnalyserNode 取时域波形算 RMS（不用已废弃的 ScriptProcessor）
  let analyser: AnalyserNode | null = null
  let samples: Uint8Array<ArrayBuffer> | null = null
  if (context) {
    try {
      const source = context.createMediaStreamSource(stream)
      analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      samples = new Uint8Array(new ArrayBuffer(analyser.fftSize))
    } catch {
      analyser = null
    }
  }

  // 录音中锁屏会被 iOS 掐断，能申请常亮就申请（iOS 16.4+）
  let wakeLock: WakeLockSentinel | null = null
  const wakeLockApi = (
    navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } }
  ).wakeLock
  try {
    wakeLock = (await wakeLockApi?.request('screen')) ?? null
  } catch {
    wakeLock = null
  }

  const release = async () => {
    for (const track of stream.getTracks()) track.stop()
    try {
      await wakeLock?.release()
    } catch {
      // 常亮锁可能在页面隐藏时已被系统释放
    }
    void context?.close()
  }

  // 每秒落一个分片，长录音不会把整段攒在内存里
  recorder.start(1000)

  return {
    level(): number {
      if (!analyser || !samples) return 0
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const value of samples) {
        const centered = (value - 128) / 128
        sum += centered * centered
      }
      const rms = Math.sqrt(sum / samples.length)
      return Math.min(1, rms * 4)
    },
    stop(): Promise<File> {
      return new Promise<File>((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            const type = recorder.mimeType || mime || 'audio/mp4'
            const blob = new Blob(chunks, { type })
            void release()
            const ext = extensionForMime(type)
            const name = fileBaseName.toLowerCase().endsWith(`.${ext}`)
              ? fileBaseName
              : `${fileBaseName}.${ext}`
            resolve(new File([blob], name, { type }))
          },
          { once: true },
        )
        recorder.stop()
      })
    },
    cancel(): void {
      if (recorder.state !== 'inactive') recorder.stop()
      void release()
    },
  }
}
