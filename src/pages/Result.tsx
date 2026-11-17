import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RotateCcw, Trophy, Layers } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { formatDuration } from '@/core/typing'
import { sfx } from '@/utils/sound'
import { saveUnitProgress } from '@/utils/progress'
import { recordResult } from '@/utils/srs'

export default function Result() {
  const book = useApp((s) => s.book)
  const unitNo = useApp((s) => s.unitNo)
  const kind = useApp((s) => s.kind)
  const queue = useApp((s) => s.queue)
  const wrongItemIds = useApp((s) => s.wrongItemIds)
  const outcomes = useApp((s) => s.outcomes)
  const startedAt = useApp((s) => s.startedAt)
  const finishedAt = useApp((s) => s.finishedAt)
  const startUnit = useApp((s) => s.startUnit)
  const backToShelf = useApp((s) => s.backToShelf)

  const total = queue.length
  const wrong = wrongItemIds.length
  const acc = total ? Math.round(((total - wrong) / total) * 100) : 0
  const duration = finishedAt && startedAt ? finishedAt - startedAt : 0
  const [added, setAdded] = useState(0)

  const sentences = book?.sentences ?? []
  const wrongSentences = useMemo(
    () => sentences.filter((s) => wrongItemIds.includes(s.id)),
    [sentences, wrongItemIds],
  )

  useEffect(() => {
    sfx.finish()
    if (!book) return
    if (kind === 'unit') saveUnitProgress(book.id, unitNo, { done: total, acc })

    let n = 0
    for (const id of queue) {
      const sentence = sentences.find((s) => s.id === id)
      if (!sentence) continue
      const ok = outcomes[id] === 'clean'
      if (recordResult(book, sentence, ok)) n += 1
    }
    setAdded(n)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const R = 56
  const C = 2 * Math.PI * R
  const tone = acc >= 90 ? '#34D399' : acc >= 70 ? '#FBBF24' : '#F87171'

  if (!book) return null

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-[560px] animate-rise">
        <div className="mb-8 flex items-center gap-2 text-[12px] text-muted/70">
          <Trophy size={14} strokeWidth={2} className="text-brand" />
          {kind === 'review' ? '错题复习完成' : `Unit ${unitNo} 完成`} ·{' '}
          {kind === 'review' ? '错题复习' : book.units.find((u) => u.no === unitNo)?.theme}
        </div>

        {/* 正确率环 */}
        <div className="relative mx-auto mb-9 h-[168px] w-[168px]">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={tone}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - (C * acc) / 100}
              style={{
                transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)',
                filter: `drop-shadow(0 0 10px ${tone}66)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabnum text-[42px] font-semibold leading-none" style={{ color: tone }}>
              {acc}
              <span className="text-[20px]">%</span>
            </span>
            <span className="mt-1.5 text-[11px] text-muted/60">一次打对率</span>
          </div>
        </div>

        {/* 数据行 */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            { k: '用时', v: formatDuration(duration) },
            { k: '句子', v: `${total} 句` },
            { k: '需再练', v: `${wrong} 句` },
          ].map((d) => (
            <div key={d.k} className="rounded-xl bg-card/70 py-4 text-center ring-1 ring-white/[0.06]">
              <div className="tabnum text-[20px] font-semibold">{d.v}</div>
              <div className="mt-1 text-[11px] text-muted/60">{d.k}</div>
            </div>
          ))}
        </div>

        {/* 错句 */}
        {wrongSentences.length > 0 ? (
          <div className="mb-8">
            <div className="mb-2.5 flex items-center gap-2 text-[12px] text-muted/70">
              <span>这些句子还要再练练</span>
              {added > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10.5px] text-brand/90">
                  <Layers size={10} strokeWidth={2.4} />
                  {added} 句已进错题本
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {wrongSentences.map((s) => (
                <div
                  key={s.id}
                  className="flex items-baseline gap-2 rounded-lg bg-err/10 px-2.5 py-1.5 ring-1 ring-err/20"
                >
                  <span className="truncate text-[12px] text-err/90">{s.cn}</span>
                  <span className="ml-auto shrink-0 truncate font-mono text-[11px] text-err/55">
                    {s.en}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-xl bg-ok/[0.07] py-4 text-center text-[13px] text-ok/85 ring-1 ring-ok/15">
            全部一次打对，这一单元可以过了 🎉
          </div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={backToShelf}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] text-muted ring-1 ring-white/10 transition hover:bg-white/5 hover:text-ink"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            返回
          </button>
          <button
            onClick={() =>
              kind === 'review'
                ? useApp.getState().startReview(book, queue)
                : startUnit(book, unitNo, 'random')
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[13px] font-medium text-white shadow-[0_6px_24px_rgba(124,92,255,0.45)] transition hover:brightness-110 active:scale-[0.99]"
          >
            <RotateCcw size={15} strokeWidth={2.2} />
            {kind === 'review' ? '再复习一遍' : '再练一遍'}
          </button>
        </div>
      </div>
    </div>
  )
}
