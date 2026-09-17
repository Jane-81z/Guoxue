import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { IconCheck, IconClose } from '../components/Icons'
import { useAppStore } from '../store/useAppStore'
import { splitPassages } from '../lib/split'
import { newId } from '../lib/id'

interface DraftLine {
  key: string
  text: string
  recite: boolean
}

export default function ImportPage() {
  const navigate = useNavigate()
  const importWork = useAppStore((s) => s.importWork)
  const notify = useAppStore((s) => s.notify)

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [dynasty, setDynasty] = useState('')
  const [tags, setTags] = useState('')
  const [raw, setRaw] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)

  const reciteCount = lines.filter((l) => l.recite).length

  const syncFromRaw = (value: string) => {
    setRaw(value)
    const texts = splitPassages(value)
    setLines((prev) =>
      texts.map((text, index) => {
        const previous = prev[index]
        const keep = previous && previous.text === text
        return {
          key: keep ? previous.key : newId(),
          text,
          recite: keep ? previous.recite : true,
        }
      }),
    )
  }

  const commit = (next: DraftLine[]) => {
    setLines(next)
    setRaw(next.map((l) => l.text).join('\n'))
  }

  const mergeIntoPrevious = (index: number) => {
    if (index <= 0) return
    const next = lines.map((l) => ({ ...l }))
    next[index - 1].text = `${next[index - 1].text}${next[index].text}`
    next.splice(index, 1)
    commit(next)
  }

  const removeLine = (index: number) => {
    commit(lines.filter((_, i) => i !== index))
  }

  const editLine = (index: number, text: string) => {
    commit(lines.map((l, i) => (i === index ? { ...l, text } : l)))
  }

  const toggleRecite = (index: number) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, recite: !l.recite } : l)))
  }

  const setAll = (recite: boolean) => setLines(lines.map((l) => ({ ...l, recite })))

  const canSubmit = title.trim().length > 0 && lines.length > 0 && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const work = await importWork({
        title,
        author,
        dynasty,
        tags: tags.split(/[,，、\s]+/).filter(Boolean),
        lines: lines.map((l) => l.text),
        reciteFlags: lines.map((l) => l.recite),
      })
      navigate(`/library?work=${work.id}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : '导入失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const preview = useMemo(() => lines, [lines])

  return (
    <>
      <PageHeader
        title="导入文本"
        subtitle="一行即一段，导入后随时可改"
        back
        onBack={() => navigate('/library')}
      />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4">
        <section className="card space-y-3 p-4">
          <div>
            <label className="label" htmlFor="work-title">
              篇名 <span className="text-cinnabar">*</span>
            </label>
            <input
              id="work-title"
              className="field"
              placeholder="如：论语·学而第一"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="work-dynasty">
                朝代
              </label>
              <input
                id="work-dynasty"
                className="field"
                placeholder="先秦"
                value={dynasty}
                onChange={(e) => setDynasty(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="work-author">
                作者
              </label>
              <input
                id="work-author"
                className="field"
                placeholder="孔子及弟子"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="work-tags">
              标签
            </label>
            <input
              id="work-tags"
              className="field"
              placeholder="四书、必背（用逗号分隔）"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </section>

        <section className="card p-4">
          <label className="label" htmlFor="raw-text">
            原文（粘贴文本，每个换行切一段）
          </label>
          <textarea
            id="raw-text"
            className="field min-h-[180px] font-song text-[16px] leading-7"
            placeholder={'子曰：学而时习之，不亦说乎？\n有朋自远方来，不亦乐乎？'}
            value={raw}
            onChange={(e) => syncFromRaw(e.target.value)}
          />
          <p className="meta mt-2">空行会被忽略；导入下方可逐段微调。</p>
        </section>

        {preview.length > 0 ? (
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-song text-base text-ink">分段预览</h2>
                <p className="meta mt-0.5">
                  共 {preview.length} 段，其中 {reciteCount} 段要背
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="chip" onClick={() => setAll(true)}>
                  全要背
                </button>
                <button type="button" className="chip" onClick={() => setAll(false)}>
                  全不背
                </button>
              </div>
            </div>
            <ul className="space-y-2.5">
              {preview.map((line, index) => (
                <li
                  key={line.key}
                  className={`rounded-[var(--c-radius)] border p-3 transition-colors ${
                    line.recite ? 'border-paper-line bg-paper-soft' : 'border-paper-line bg-paper-deep/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={line.recite ? '取消背诵' : '设为要背'}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--c-radius-sm)] border ${
                        line.recite
                          ? 'border-jade bg-jade text-paper-soft'
                          : 'border-paper-line text-ink-faint'
                      }`}
                      onClick={() => toggleRecite(index)}
                    >
                      {line.recite ? <IconCheck className="h-3.5 w-3.5" /> : null}
                    </button>
                    <span className="w-6 shrink-0 text-center text-xs tabular-nums text-ink-faint">
                      {index + 1}
                    </span>
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 font-song text-[16px] leading-6 text-ink outline-none"
                      value={line.text}
                      onChange={(e) => editLine(index, e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label="与上一段合并"
                      className="shrink-0 rounded-[var(--c-radius-sm)] px-1.5 py-1 text-[11px] text-ink-faint disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => mergeIntoPrevious(index)}
                    >
                      合并
                    </button>
                    <button
                      type="button"
                      aria-label="删除该段"
                      className="shrink-0 rounded-[var(--c-radius-sm)] p-1 text-ink-faint"
                      onClick={() => removeLine(index)}
                    >
                      <IconClose className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] pb-2">
          <button
            type="button"
            className="btn btn-primary w-full py-3 text-[15px]"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {saving ? '正在导入…' : `确认导入${lines.length ? `（${lines.length} 段）` : ''}`}
          </button>
        </div>
      </div>
    </>
  )
}
