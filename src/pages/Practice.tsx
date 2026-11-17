import { useEffect, useState } from 'react'
import { useApp } from '@/store/useApp'
import { BottomBar, ProgressBar, StageFrame, TopBar } from '@/components/StageFrame'
import SentenceBoard from '@/components/SentenceBoard'
import { formatDuration, isPunct } from '@/core/typing'
import { sfx } from '@/utils/sound'
import { speak, warmupSpeech } from '@/utils/speech'
import { markMastered } from '@/utils/srs'

export default function Practice() {
  const book = useApp((s) => s.book)
  const unitNo = useApp((s) => s.unitNo)
  const kind = useApp((s) => s.kind)
  const queue = useApp((s) => s.queue)
  const index = useApp((s) => s.index)
  const tokenIndex = useApp((s) => s.tokenIndex)
  const typed = useApp((s) => s.typed)
  const shakeKey = useApp((s) => s.shakeKey)
  const wrongTokenIdx = useApp((s) => s.wrongTokenIdx)
  const typeKey = useApp((s) => s.typeKey)
  const backspace = useApp((s) => s.backspace)
  const skipToken = useApp((s) => s.skipToken)
  const skipSentence = useApp((s) => s.skipSentence)
  const advance = useApp((s) => s.advance)
  const prevSentence = useApp((s) => s.prevSentence)
  const backToShelf = useApp((s) => s.backToShelf)

  const [elapsed, setElapsed] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [toast, setToast] = useState('')

  const unit = book?.units.find((u) => u.no === unitNo)
  const sentence = book?.sentences?.find((s) => s.id === queue[index])
  const total = queue.length

  const doSpeak = () => {
    if (sentence) speak(sentence.en, { rate: 0.8 })
  }

  /* 计时 */
  useEffect(() => {
    const t = window.setInterval(() => setElapsed(useApp.getState().elapsed()), 500)
    return () => window.clearInterval(t)
  }, [])

  /* 换句：重置局部状态并自动朗读英文 */
  useEffect(() => {
    setReveal(false)
    if (!sentence) return
    warmupSpeech()
    const t = window.setTimeout(() => speak(sentence.en, { rate: 0.8 }), 240)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const doReveal = () => {
    setReveal(true)
    window.setTimeout(() => setReveal(false), 2200)
  }

  const doMaster = () => {
    if (!book || !sentence) return
    markMastered(book.id, sentence.id)
    setToast('已移出错题本')
    window.setTimeout(() => setToast(''), 1600)
  }

  /* 键盘 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === 'Escape') return backToShelf()
      if (e.key === 'Backspace') {
        e.preventDefault()
        return backspace()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        return skipSentence()
      }
      if (e.key === ' ') {
        e.preventDefault()
        return skipToken()
      }
      if (e.key.length !== 1) return
      e.preventDefault()

      /* 标点不参与判定：孩子顺手打出句号/问号也不该算错，直接忽略 */
      if (isPunct(e.key)) return

      const result = typeKey(e.key)
      if (result === 'bad') {
        sfx.bad()
      } else if (result === 'ok') {
        sfx.ok()
      } else if (result === 'word') {
        sfx.ok()
      } else if (result === 'done') {
        sfx.done()
        window.setTimeout(() => advance(), 280)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [typeKey, backspace, skipToken, skipSentence, advance, backToShelf])

  if (!book || !sentence) return null

  return (
    <StageFrame>
      <TopBar
        title={book.title}
        unitLabel={kind === 'review' ? '错题复习' : `Unit ${unitNo}`}
        onBack={backToShelf}
      />
      <ProgressBar
        done={index}
        total={total}
        timeText={formatDuration(elapsed)}
        label={kind === 'review' ? '已复习' : '已练句'}
      />

      <main className="relative flex min-h-0 flex-1 flex-col px-5 pb-1 pt-1">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <SentenceBoard
            sentence={sentence}
            tokenIndex={tokenIndex}
            typed={typed}
            shakeKey={shakeKey}
            wrongTokens={wrongTokenIdx}
            reveal={reveal}
            onSpeak={doSpeak}
          />
        </div>

        {toast && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-rise rounded-lg bg-card px-3.5 py-2 text-[12px] text-ink/85 ring-1 ring-white/10">
            {toast}
          </div>
        )}
      </main>

      <BottomBar
        onPrev={prevSentence}
        onSkip={skipSentence}
        onNext={skipSentence}
        onReveal={doReveal}
        onMaster={doMaster}
        hintLeft={
          <span className="truncate">
            {kind === 'review' ? '错题复习' : unit?.theme ?? ''}
            <span className="ml-2 text-muted/35">
              {index + 1}/{total}
            </span>
          </span>
        }
      />
    </StageFrame>
  )
}
