import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RECORDER_BITRATE,
  checkRecorderSupport,
  describeMicError,
  extensionForMime,
  pickRecorderMime,
} from './recorder'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pickRecorderMime', () => {
  it('能录 mp4 时优先 mp4（Safari 只给这个，正好不用转码）', () => {
    const mime = pickRecorderMime((type) => type.startsWith('audio/mp4') || type.includes('webm'))
    expect(mime).toBe('audio/mp4;codecs=mp4a.40.2')
  })

  it('只有 webm 时退回 webm（Chrome）', () => {
    expect(pickRecorderMime((type) => type.includes('webm'))).toBe('audio/webm;codecs=opus')
  })

  it('一个都不支持时返回空串，交给 MediaRecorder 自己决定', () => {
    expect(pickRecorderMime(() => false)).toBe('')
  })
})

describe('extensionForMime', () => {
  it('按容器给扩展名', () => {
    expect(extensionForMime('audio/mp4')).toBe('m4a')
    expect(extensionForMime('audio/mp4;codecs=mp4a.40.2')).toBe('m4a')
    expect(extensionForMime('audio/aac')).toBe('m4a')
    expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionForMime('audio/ogg')).toBe('ogg')
  })

  it('认不出来时不瞎猜，落回 m4a（我们的解码链路首选）', () => {
    expect(extensionForMime('')).toBe('m4a')
    expect(extensionForMime('application/octet-stream')).toBe('m4a')
  })
})

describe('describeMicError', () => {
  it('权限被拒时告诉去哪儿开', () => {
    expect(describeMicError(new DOMException('x', 'NotAllowedError'))).toMatch(/设置 → Safari → 麦克风/)
  })

  it('没麦克风与麦克风被占用分别有各自的话', () => {
    expect(describeMicError(new DOMException('x', 'NotFoundError'))).toMatch(/没找到麦克风/)
    expect(describeMicError(new DOMException('x', 'NotReadableError'))).toMatch(/别的 App 占着/)
  })

  it('不认识的原因也带上原文，别吞掉', () => {
    expect(describeMicError(new Error('boom'))).toBe('无法开始录音：boom')
  })
})

describe('checkRecorderSupport', () => {
  const mic = { getUserMedia: async () => ({}) as unknown as MediaStream }

  it('安全上下文 + 麦克风接口 + MediaRecorder 才算支持', () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', { mediaDevices: mic })
    vi.stubGlobal('MediaRecorder', class {})
    expect(checkRecorderSupport().supported).toBe(true)
  })

  it('不是 https 时说明原因', () => {
    vi.stubGlobal('window', { isSecureContext: false })
    vi.stubGlobal('location', { hostname: 'example.com' })
    vi.stubGlobal('navigator', { mediaDevices: mic })
    vi.stubGlobal('MediaRecorder', class {})
    expect(checkRecorderSupport().reason).toMatch(/https/)
  })

  it('没有 MediaRecorder 时点名 iOS 版本要求', () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', { mediaDevices: mic })
    vi.stubGlobal('MediaRecorder', undefined)
    expect(checkRecorderSupport().reason).toMatch(/14\.5/)
  })

  it('连麦克风接口都没有时也是不支持', () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('MediaRecorder', class {})
    expect(checkRecorderSupport().supported).toBe(false)
  })
})

describe('录音码率', () => {
  it('定在 64 kbps，约 0.46 MB/分钟', () => {
    expect(RECORDER_BITRATE).toBe(64000)
    expect((RECORDER_BITRATE / 8) * 60).toBeLessThan(500_000)
  })
})
