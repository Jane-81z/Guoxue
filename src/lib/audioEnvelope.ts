import { computeEnvelope, mixToMono, type Envelope } from './audioSplit'

/** 解码音频文件并算出包络：整段录音切分的第一步（全在本地，不联网） */
export async function fileToEnvelope(file: File, windowMs = 20): Promise<Envelope> {
  const buffer = await file.arrayBuffer()
  const Ctor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('这个浏览器不支持音频解码')

  const context = new Ctor()
  try {
    const decoded = await context.decodeAudioData(buffer.slice(0))
    const channels: Float32Array[] = []
    for (let i = 0; i < decoded.numberOfChannels; i += 1) channels.push(decoded.getChannelData(i))
    const mono = mixToMono(channels)
    return computeEnvelope(mono, decoded.sampleRate, windowMs)
  } catch {
    throw new Error('这个音频格式解不开，试试 m4a / mp3 / wav')
  } finally {
    void context.close()
  }
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
