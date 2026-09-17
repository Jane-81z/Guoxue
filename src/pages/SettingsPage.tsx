import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Dialog from '../components/Dialog'
import Band from '../components/Band'
import { IconDownload, IconUpload } from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { buildDailyReminderIcs } from '../lib/ics'
import { downloadBlob } from '../lib/backup'
import { todayKey } from '../lib/date'
import { findTheme } from '../theme/themes'
import { MAX_RECITE_PACE, MIN_RECITE_PACE } from '../lib/estimate'

const APP_VERSION = '0.1.0'

/** 状态灯键：开＝段点亮成绿，关＝熄灭 */
function LampKey({
  on,
  onLabel,
  offLabel,
  onPress,
}: {
  on: boolean
  onLabel: string
  offLabel: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      className={`flex items-center gap-2 border px-2.5 py-1.5 ${
        on ? 'border-done/55' : 'border-hairline'
      }`}
      style={{ borderRadius: 'var(--c-radius-sm)' }}
    >
      <span className="segbar w-3">
        <i className={`seg ${on ? 'seg-done' : ''}`} />
        <i className={`seg ${on ? 'seg-done' : ''}`} />
      </span>
      <span className={`readout text-[11px] ${on ? 'text-done' : 'text-dim'}`}>
        {on ? onLabel : offLabel}
      </span>
    </button>
  )
}

/** 动作键 */
function ActKey({
  label,
  onPress,
  tone = 'default',
}: {
  label: string
  onPress: () => void
  tone?: 'default' | 'alert'
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`border px-3 py-1.5 text-[13px] ${
        tone === 'alert'
          ? 'border-alert/50 text-alert hover:bg-alert/5'
          : 'border-hairline text-fg-soft hover:bg-well'
      }`}
      style={{ borderRadius: 'var(--c-radius-sm)' }}
    >
      {label}
    </button>
  )
}

function GroupLabel({ children }: { children: string }) {
  return <p className="readout px-1 pt-2 text-[10px] tracking-[0.24em] text-dim">{children}</p>
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
  const [openBand, setOpenBand] = useState<string | null>(null)
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
    downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), '国学背诵-每日提醒.ics')
    notify('日历文件已下载，导入「日历」App 即可每日提醒', 'success')
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 MB'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const toggleBand = (id: string) => setOpenBand((prev) => (prev === id ? null : id))
  const sliderClass = 'w-full accent-[#FF2E1F]'

  return (
    <>
      <PageHeader title="设置" subtitle={`国学背诵 v${APP_VERSION} · 所有数据只在本机`} />

      <div className="mx-auto max-w-2xl space-y-2 px-4 py-4">
        <GroupLabel>显示 DISPLAY</GroupLabel>
        <Band
          label="视觉世界"
          value={findTheme(settings.theme).name}
          tone="dim"
          action={<ActKey label="查看" onPress={() => navigate('/design')} />}
        />
        <Band
          label="正文字号"
          value={`${settings.fontScale.toFixed(2)}×`}
          open={openBand === 'font'}
          onToggle={() => toggleBand('font')}
        >
          <input
            type="range"
            min={0.85}
            max={1.5}
            step={0.05}
            value={settings.fontScale}
            className={sliderClass}
            onChange={(e) => void updateSettings({ fontScale: Number.parseFloat(e.target.value) })}
          />
        </Band>
        <Band
          label="正文行高"
          value={settings.lineHeight.toFixed(2)}
          open={openBand === 'line'}
          onToggle={() => toggleBand('line')}
        >
          <input
            type="range"
            min={1.5}
            max={2.6}
            step={0.05}
            value={settings.lineHeight}
            className={sliderClass}
            onChange={(e) => void updateSettings({ lineHeight: Number.parseFloat(e.target.value) })}
          />
        </Band>
        <Band
          label="篇目页显示拼音"
          control={
            <LampKey
              on={settings.pinyinVisible}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSettings({ pinyinVisible: !settings.pinyinVisible })}
            />
          }
        />
        <Band
          label="复习时带拼音"
          control={
            <LampKey
              on={settings.pinyinInReview}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSettings({ pinyinInReview: !settings.pinyinInReview })}
            />
          }
        />
        <Band
          label="竖排显示正文"
          control={
            <LampKey
              on={settings.vertical}
              onLabel="ON"
              offLabel="OFF"
              onPress={() => void updateSettings({ vertical: !settings.vertical })}
            />
          }
        />
        <Band
          label="背诵速度"
          kicker="字 / 分钟"
          value={String(settings.recitePace)}
          hint="决定首页「预计用时」读数"
          open={openBand === 'pace'}
          onToggle={() => toggleBand('pace')}
        >
          <input
            type="range"
            min={MIN_RECITE_PACE}
            max={MAX_RECITE_PACE}
            step={10}
            value={settings.recitePace}
            className={sliderClass}
            onChange={(e) => void updateSettings({ recitePace: Number.parseInt(e.target.value, 10) })}
          />
        </Band>

        <GroupLabel>提醒 REMINDER</GroupLabel>
        <Band
          label="每日提醒时间"
          value={settings.reminderTime}
          open={openBand === 'reminder'}
          onToggle={() => toggleBand('reminder')}
        >
          <input
            type="time"
            className="field"
            value={settings.reminderTime}
            onChange={(e) => void updateSettings({ reminderTime: e.target.value })}
          />
        </Band>
        <Band
          label="导出日历提醒"
          kicker="ICS · 一次导入长期有效"
          action={<ActKey label="导出" onPress={downloadIcs} />}
        />

        <GroupLabel>数据 DATA</GroupLabel>
        <Band
          label="篇目与段落"
          kicker="篇 / 段 / 录音"
          value={`${works.length} / ${passages.length} / ${audios.length}`}
          hint={storage ? `已占用 ${formatSize(storage.usage)}` : undefined}
        />
        <Band
          label="导出数据"
          kicker="JSON"
          action={
            <button
              type="button"
              className="flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[13px] text-fg-soft hover:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={() => void exportJson()}
            >
              <IconDownload className="h-3.5 w-3.5" />
              导出
            </button>
          }
        />
        <Band
          label="导入数据"
          kicker="JSON · 覆盖当前"
          action={
            <button
              type="button"
              className="flex items-center gap-1.5 border border-hairline px-3 py-1.5 text-[13px] text-fg-soft hover:bg-well"
              style={{ borderRadius: 'var(--c-radius-sm)' }}
              onClick={() => jsonInputRef.current?.click()}
            >
              <IconUpload className="h-3.5 w-3.5" />
              导入
            </button>
          }
        />
        <Band
          label="导出录音"
          kicker="ZIP · 按篇目打包"
          action={<ActKey label="导出" onPress={() => void exportAudio()} />}
        />
        <Band
          label="导入录音"
          kicker="ZIP · 先导数据"
          action={<ActKey label="导入" onPress={() => zipInputRef.current?.click()} />}
        />
        <Band
          label="持久化存储"
          hint={storage?.persisted ? '浏览器不会自动清理' : '建议开启，避免数据被清理'}
          control={
            <LampKey
              on={!!storage?.persisted}
              onLabel="ON"
              offLabel="申请"
              onPress={() => void requestPersist()}
            />
          }
        />

        <GroupLabel>装到手机上 INSTALL</GroupLabel>
        <Band
          label="添加到主屏幕"
          kicker="SAFARI → 分享 → 添加到主屏幕"
          value="3 步"
          tone="dim"
          open={openBand === 'install'}
          onToggle={() => toggleBand('install')}
        >
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-fg-soft">
            <li>用 iPhone 的 Safari 打开本站地址</li>
            <li>点底部的「分享」按钮</li>
            <li>选择「添加到主屏幕」，之后就像 App 一样全屏打开</li>
          </ol>
          <p className="mt-2 text-[13px] leading-relaxed text-dim">
            未添加到主屏时，iOS 可能在长期不用后清理本地数据。请务必添加到主屏，并定期导出备份。
          </p>
        </Band>

        <GroupLabel>危险 IRREVERSIBLE</GroupLabel>
        <Band
          label="清空全部数据"
          kicker="不可恢复"
          hint="删除所有篇目、录音与复习记录"
          danger
          action={
            <ActKey
              label="清空"
              tone="alert"
              onPress={() => {
                setClearWord('')
                setConfirmClear(true)
              }}
            />
          }
        />

        <p className="pb-2 pt-3 text-center text-[13px] leading-relaxed text-dim">
          数据只存在这台设备的浏览器里，不上传服务器。
          <br />
          换手机时先导出数据与录音，再在新设备导入。
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
