/**
 * 按停顿切分整篇录音。
 * 规则很简单（使用者自己录的时候每段之间会停 2 秒）：相邻音频之间的静音一旦达到
 * `minSilenceSeconds`，就在这段静音的中点切一刀。
 *
 * 这一层只吃「包络」——把解码、混声道留给调用方，于是算法本身可以直接单测。
 */

export interface Envelope {
  /** 每个时间窗的均方根音量（0–1） */
  rms: Float32Array
  /** 每个窗覆盖的毫秒数 */
  windowMs: number
  /** 音频总时长（毫秒） */
  durationMs: number
}

export interface SilenceRange {
  startMs: number
  endMs: number
}

export interface SplitOptions {
  /** 静音判定：低于峰值这么多分贝就算静音（默认 -40dB） */
  thresholdDb?: number
  /** 多长的停顿才算段间分界（秒，默认 2.0） */
  minSilenceSeconds?: number
  /** 太短的片段不单独成段（毫秒，默认 200） */
  minSegmentMs?: number
}

export interface SplitResult {
  /** 切点（毫秒），长度 = 段数 - 1 */
  cuts: number[]
  /** 切出来的段（毫秒） */
  segments: SilenceRange[]
  /** 检出的长静音，供界面显示 */
  silences: SilenceRange[]
}

/** 把波形采样按固定窗长压成包络（取每窗的均方根） */
export function computeEnvelope(
  samples: Float32Array,
  sampleRate: number,
  windowMs = 20,
): Envelope {
  const windowSize = Math.max(1, Math.round((sampleRate * windowMs) / 1000))
  const count = Math.max(1, Math.ceil(samples.length / windowSize))
  const rms = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const start = i * windowSize
    const end = Math.min(samples.length, start + windowSize)
    let sum = 0
    for (let j = start; j < end; j += 1) sum += samples[j] * samples[j]
    rms[i] = end > start ? Math.sqrt(sum / (end - start)) : 0
  }
  return {
    rms,
    windowMs,
    durationMs: (samples.length / sampleRate) * 1000,
  }
}

/** 把多声道混成单声道，供 computeEnvelope 使用 */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const length = channels[0].length
  const mono = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    let sum = 0
    for (const channel of channels) sum += channel[i] ?? 0
    mono[i] = sum / channels.length
  }
  return mono
}

const DEFAULTS = {
  thresholdDb: -40,
  minSilenceSeconds: 2,
  minSegmentMs: 200,
}

/**
 * 按停顿切分：找出一段段「低于阈值的连续窗」，其中时长 ≥ minSilenceSeconds 的，
 * 取中点作为切点。
 */
export function splitBySilence(envelope: Envelope, options: SplitOptions = {}): SplitResult {
  const thresholdDb = options.thresholdDb ?? DEFAULTS.thresholdDb
  const minSilenceSeconds = options.minSilenceSeconds ?? DEFAULTS.minSilenceSeconds
  const minSegmentMs = options.minSegmentMs ?? DEFAULTS.minSegmentMs

  const { rms, windowMs, durationMs } = envelope
  const peak = rms.reduce((max, value) => (value > max ? value : max), 0)
  const empty: SplitResult = {
    cuts: [],
    segments: durationMs > 0 ? [{ startMs: 0, endMs: durationMs }] : [],
    silences: [],
  }
  if (peak <= 0 || durationMs <= 0) return empty

  // -40dB 即峰值的 1%，乘一个 0.98 的余量避免浮点误差把静音判成有声
  const threshold = peak * Math.pow(10, thresholdDb / 20) * 0.98
  const minSilenceMs = minSilenceSeconds * 1000

  const silences: SilenceRange[] = []
  let runStart = -1
  for (let i = 0; i <= rms.length; i += 1) {
    const silent = i < rms.length && rms[i] <= threshold
    if (silent && runStart < 0) runStart = i
    if (!silent && runStart >= 0) {
      const startMs = runStart * windowMs
      const endMs = Math.min(durationMs, i * windowMs)
      if (endMs - startMs >= minSilenceMs) silences.push({ startMs, endMs })
      runStart = -1
    }
  }

  // 清理：长静音中间如果只夹了一点点杂音（咳嗽、翻页），把它当成同一段静音，
  // 否则那一小点杂音会被切成一个多余的"段"。
  const merged: SilenceRange[] = []
  for (const silence of silences) {
    const previous = merged[merged.length - 1]
    if (previous && silence.startMs - previous.endMs < minSegmentMs) {
      previous.endMs = silence.endMs
    } else {
      merged.push({ ...silence })
    }
  }

  const cuts: number[] = []
  for (const silence of merged) {
    const cut = Math.round((silence.startMs + silence.endMs) / 2)
    const previous = cuts[cuts.length - 1] ?? 0
    if (cut - previous >= minSegmentMs && durationMs - cut >= minSegmentMs) cuts.push(cut)
  }

  const bounds = [0, ...cuts, durationMs]
  const segments: SilenceRange[] = []
  for (let i = 0; i < bounds.length - 1; i += 1) {
    segments.push({ startMs: Math.round(bounds[i]), endMs: Math.round(bounds[i + 1]) })
  }

  return { cuts, segments, silences }
}
