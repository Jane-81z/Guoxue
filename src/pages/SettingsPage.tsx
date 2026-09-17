import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import PageHeader from '../components/PageHeader'
import Dialog from '../components/Dialog'
import {
  IconCalendar,
  IconDownload,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { buildDailyReminderIcs } from '../lib/ics'
import { downloadBlob } from '../lib/backup'
import { todayKey } from '../lib/date'
import { findTheme } from '../theme/themes'
import { useNavigate } from 'react-router-dom'
import { MAX_RECITE_PACE, MIN_RECITE_PACE } from '../lib/estimate'

const APP_VERSION = '0.1.0'

function Row({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[15px] text-ink">{title}</p>
        {hint ? <p className="meta mt-0.5">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`relative h-7 w-12 rounded-full border transition-colors ${
        value ? 'border-jade bg-jade' : 'border-paper-line bg-paper-deep'
      }`}
      onClick={() => onChange(!value)}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-soft shadow transition-all ${
          value ? 'left-6' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const exportJson = useAppStore((s) => s.exportJson)
  const importJson = useAppStore((s) => s.importJson)
  const exportAudio = useAppStore((s) => s.exportAudio)
  const importAudio = useAppStore((s) => s.importAudio)
  const clearAll = useAppStore((s) => s.clearAll)
  const notify = useAppStore((s) => s.notify)
  const works = useAppStore((s) => s.works)
  const passages = useAppStore((s) => s.passages)
  const audios = useAppStore((s) => s.audios)

  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(
    null,
  )
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearWord, setClearWord] = useState('')
  const [pendingImport, setPendingImport] = useState<File | null>(null)

  const jsonInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const estimate = await navigator.storage?.estimate?.()
        const persisted = (await navigator.storage?.persisted?.()) ?? false
        if (!cancelled) {
          setStorage({
            usage: estimate?.usage ?? 0,
            quota: estimate?.quota ?? 0,
            persisted,
          })
        }
      } catch {
        // 忽略
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [audios.length])

  const requestPersist = async () => {
    try {
      const granted = (await navigator.storage?.persist?.()) ?? false
      notify(granted ? '已获得持久化存储权限' : '浏览器未授予持久化权限', granted ? 'success' : 'error')
      const estimate = await navigator.storage?.estimate?.()
      setStorage({
        usage: estimate?.usage ?? 0,
        quota: estimate?.quota ?? 0,
        persisted: granted,
      })
    } catch {
      notify('当前浏览器不支持该设置', 'error')
    }
  }

  const downloadIcs = () => {
    const ics = buildDailyReminderIcs({
      time: settings.reminderTime,
      startDate: todayKey(),
      title: '今日背书',
      description: '打开「国学背诵」，完成今日到期的复习卡片。',
    })
    downloadBlob(
      new Blob([ics], { type: 'text/calendar;charset=utf-8' }),
      '国学背诵-每日提醒.ics',
    )
    notify('日历文件已下载，导入「日历」App 即可每日提醒', 'success')
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 MB'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <>
      <PageHeader title="设置" subtitle={`国学背诵 v${APP_VERSION}`} />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="card px-4 py-1.5">
          <h2 className="pt-3 font-song text-base text-ink">显示</h2>
          <div className="divide-y divide-paper-line">
            <Row title="视觉世界" hint={`当前：${findTheme(settings.theme).name}`}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/design')}>
                切换
              </button>
            </Row>
            <Row
              title="背诵速度"
              hint={`${settings.recitePace} 字/分钟 · 决定「预计用时」读数`}
            >
              <input
                type="range"
                min={MIN_RECITE_PACE}
                max={MAX_RECITE_PACE}
                step={10}
                value={settings.recitePace}
                className="w-36 accent-[#FF2E1F]"
                onChange={(e) =>
                  void updateSettings({ recitePace: Number.parseInt(e.target.value, 10) })
                }
              />
            </Row>
            <Row title="正文字号" hint={`${settings.fontScale.toFixed(2)} 倍`}>
              <input
                type="range"
                min={0.85}
                max={1.5}
                step={0.05}
                value={settings.fontScale}
                className="w-36 accent-[#23211E]"
                onChange={(e) =>
                  void updateSettings({ fontScale: Number.parseFloat(e.target.value) })
                }
              />
            </Row>
            <Row title="正文行高" hint={settings.lineHeight.toFixed(2)}>
              <input
                type="range"
                min={1.5}
                max={2.6}
                step={0.05}
                value={settings.lineHeight}
                className="w-36 accent-[#23211E]"
                onChange={(e) =>
                  void updateSettings({ lineHeight: Number.parseFloat(e.target.value) })
                }
              />
            </Row>
            <Row title="篇目页显示拼音" hint="汉字上方注音">
              <Toggle
                value={settings.pinyinVisible}
                onChange={(next) => void updateSettings({ pinyinVisible: next })}
              />
            </Row>
            <Row title="复习显示原文时带拼音">
              <Toggle
                value={settings.pinyinInReview}
                onChange={(next) => void updateSettings({ pinyinInReview: next })}
              />
            </Row>
            <Row title="竖排显示正文" hint="适合熟悉竖读的篇目">
              <Toggle
                value={settings.vertical}
                onChange={(next) => void updateSettings({ vertical: next })}
              />
            </Row>
          </div>
        </section>

        <section className="card px-4 py-1.5">
          <h2 className="pt-3 font-song text-base text-ink">复习提醒</h2>
          <div className="divide-y divide-paper-line">
            <Row title="每日提醒时间" hint="导出日历后每天此时提醒">
              <input
                type="time"
                className="field w-28 py-1.5 text-center"
                value={settings.reminderTime}
                onChange={(e) => void updateSettings({ reminderTime: e.target.value })}
              />
            </Row>
            <Row title="导出日历提醒（.ics）" hint="导入 iPhone 日历，一次长期有效">
              <button type="button" className="btn btn-ghost" onClick={downloadIcs}>
                <IconCalendar className="h-4 w-4" />
                导出
              </button>
            </Row>
          </div>
          <p className="meta pb-3">
            提示：这是每天固定时间的循环提醒，不会逐卡排期。今天该背什么，打开 App 首页即知。
          </p>
        </section>

        <section className="card px-4 py-1.5">
          <h2 className="pt-3 font-song text-base text-ink">数据与备份</h2>
          <p className="meta mt-1">
            当前 {works.length} 篇　{passages.length} 段　{audios.length} 段录音
            {storage ? `　占用 ${formatSize(storage.usage)}` : ''}
          </p>
          <div className="divide-y divide-paper-line">
            <Row title="导出数据（JSON）" hint="原文、拼音、注释、复习进度与打卡">
              <button type="button" className="btn btn-ghost" onClick={() => void exportJson()}>
                <IconDownload className="h-4 w-4" />
                导出
              </button>
            </Row>
            <Row title="导入数据（JSON）" hint="会覆盖当前全部文字数据">
              <button type="button" className="btn btn-ghost" onClick={() => jsonInputRef.current?.click()}>
                <IconUpload className="h-4 w-4" />
                导入
              </button>
            </Row>
            <Row title="导出录音（ZIP）" hint="按篇目打包全部音频文件">
              <button type="button" className="btn btn-ghost" onClick={() => void exportAudio()}>
                <IconDownload className="h-4 w-4" />
                导出
              </button>
            </Row>
            <Row title="导入录音（ZIP）" hint="需先导入对应的数据文件">
              <button type="button" className="btn btn-ghost" onClick={() => zipInputRef.current?.click()}>
                <IconUpload className="h-4 w-4" />
                导入
              </button>
            </Row>
            <Row
              title="持久化存储"
              hint={storage?.persisted ? '已开启，浏览器不会自动清理' : '建议开启，避免数据被清理'}
            >
              <button
                type="button"
                className="btn btn-ghost"
                disabled={storage?.persisted}
                onClick={() => void requestPersist()}
              >
                {storage?.persisted ? '已开启' : '申请'}
              </button>
            </Row>
          </div>
        </section>

        <section className="card px-4 py-1.5">
          <h2 className="pt-3 font-song text-base text-ink">装到手机上</h2>
          <ol className="list-decimal space-y-1.5 py-3 pl-5 text-sm leading-relaxed text-ink-soft">
            <li>用 iPhone 的 Safari 打开本站地址</li>
            <li>点底部的「分享」按钮</li>
            <li>选择「添加到主屏幕」，之后就像 App 一样全屏打开</li>
          </ol>
          <p className="meta pb-3">
            未添加到主屏时，iOS 可能在长期不用后清理本地数据，请务必添加到主屏并定期导出备份。
          </p>
        </section>

        <section className="card px-4 py-1.5">
          <h2 className="pt-3 font-song text-base text-ink">危险操作</h2>
          <Row title="清空全部数据" hint="删除所有篇目、录音与复习记录">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setClearWord('')
                setConfirmClear(true)
              }}
            >
              <IconTrash className="h-4 w-4" />
              清空
            </button>
          </Row>
          <div className="pb-3" />
        </section>

        <p className="pb-4 text-center text-[11px] leading-relaxed text-ink-faint">
          所有数据都存在这台设备的浏览器里，不上传服务器。
          <br />
          换手机时请先导出数据与录音，再在新设备导入。
        </p>
      </div>

      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) setPendingImport(file)
          e.target.value = ''
        }}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept="application/zip,.zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importAudio(file)
          e.target.value = ''
        }}
      />

      <Dialog
        open={!!pendingImport}
        title="导入数据会覆盖当前内容"
        description={`文件：${pendingImport?.name ?? ''}。当前的篇目、段落与复习进度会被替换，录音文件不受影响。`}
        confirmText="覆盖导入"
        danger
        onConfirm={() => {
          const file = pendingImport
          setPendingImport(null)
          if (file) void importJson(file)
        }}
        onCancel={() => setPendingImport(null)}
      />

      <Dialog
        open={confirmClear}
        title="清空全部数据？"
        description="所有篇目、原文、拼音、注释、录音与复习记录都会永久删除，无法恢复。"
        confirmText="永久清空"
        confirmDisabled={clearWord !== '清空'}
        danger
        onConfirm={() => {
          setConfirmClear(false)
          void clearAll()
        }}
        onCancel={() => setConfirmClear(false)}
      >
        <input
          className="field"
          placeholder="输入「清空」以确认"
          value={clearWord}
          onChange={(e) => setClearWord(e.target.value)}
        />
      </Dialog>
    </>
  )
}
