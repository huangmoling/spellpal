import { useEffect, useMemo, useRef, useState } from 'react'
import { Music2, Volume2 } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { BottomBar, ProgressBar, StageFrame, TopBar } from '@/components/StageFrame'
import WordSlot from '@/components/WordSlot'
import { formatDuration, MODES, type PracticeMode } from '@/core/typing'
import { sfx } from '@/utils/sound'
import { speak, warmupSpeech } from '@/utils/speech'
import { markMastered } from '@/utils/srs'

export default function Practice() {
  const book = useApp((s) => s.book)
  const unitNo = useApp((s) => s.unitNo)
  const kind = useApp((s) => s.kind)
  const mode = useApp((s) => s.mode)
  const queue = useApp((s) => s.queue)
  const index = useApp((s) => s.index)
  const typed = useApp((s) => s.typed)
  const hint = useApp((s) => s.hint)
  const shakeKey = useApp((s) => s.shakeKey)
  const typeKey = useApp((s) => s.typeKey)
  const backspace = useApp((s) => s.backspace)
  const completeWord = useApp((s) => s.completeWord)
  const skipWord = useApp((s) => s.skipWord)
  const prevWord = useApp((s) => s.prevWord)
  const toggleHint = useApp((s) => s.toggleHint)
  const backToShelf = useApp((s) => s.backToShelf)

  const [elapsed, setElapsed] = useState(0)
  const [errorPos, setErrorPos] = useState<number | null>(null)
  const [reveal, setReveal] = useState(false)
  const [misses, setMisses] = useState(0)
  const [toast, setToast] = useState('')
  const lockRef = useRef(false)
  const errTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)

  const unit = book?.units.find((u) => u.no === unitNo)
  const word = useMemo(() => book?.words.find((w) => w.id === queue[index]), [book, queue, index])
  const total = queue.length
  const listen = mode === 'listen'

  const doSpeak = () => {
    if (word) speak(word.word)
  }

  /* 计时 */
  useEffect(() => {
    const t = window.setInterval(() => setElapsed(useApp.getState().elapsed()), 500)
    return () => window.clearInterval(t)
  }, [])

  /* 换词时重置局部状态 + 自动发音 */
  useEffect(() => {
    lockRef.current = false
    setErrorPos(null)
    setReveal(false)
    setMisses(0)
  }, [index])

  useEffect(() => {
    if (!listen || !word) return
    warmupSpeech()
    const t = window.setTimeout(() => speak(word.word), 260)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, listen])

  const doReveal = () => {
    setReveal(true)
    if (listen && word) speak(word.word, { rate: 0.62 })
    window.setTimeout(() => setReveal(false), 2200)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 1600)
  }

  const doMaster = () => {
    if (!book || !word) return
    markMastered(book.id, word.id)
    showToast('已移出错题本')
    window.setTimeout(() => skipWord(), 220)
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
        return skipWord()
      }
      if (e.key === ' ') e.preventDefault()
      if (e.key.length !== 1) return
      if (lockRef.current) return
      e.preventDefault()

      const result = typeKey(e.key)
      if (result === 'bad') {
        sfx.bad()
        setErrorPos(typed.length)
        setMisses((m) => m + 1)
        window.clearTimeout(errTimer.current)
        errTimer.current = window.setTimeout(() => setErrorPos(null), 420)
      } else if (result === 'ok') {
        sfx.ok()
        setErrorPos(null)
      } else if (result === 'done') {
        sfx.done()
        setErrorPos(null)
        lockRef.current = true
        window.setTimeout(() => completeWord(), 260)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [typeKey, backspace, skipWord, completeWord, backToShelf, typed.length])

  if (!book || !word) return null

  const modeInfo = MODES.find((m) => m.key === mode)!
  /* 听音模式：连续错 2 次自动给中文提示，避免孩子卡死 */
  const cnHint = listen ? (misses >= 2 ? word.senses[0]?.cn : undefined) : word.senses[0]?.cn

  return (
    <StageFrame>
      <TopBar
        title={book.title}
        unitLabel={kind === 'review' ? '错题复习' : `Unit ${unitNo}`}
        onBack={backToShelf}
        right={
          <>
            <span className="mr-1 hidden items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-muted/75 sm:flex">
              <ModeIcon mode={mode} />
              {modeInfo.label}
            </span>
            <button
              onClick={toggleHint}
              className={`mr-1 hidden h-8 items-center rounded-lg px-2.5 text-[12px] transition sm:flex ${
                hint ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-white/5 hover:text-ink'
              }`}
            >
              提示
            </button>
          </>
        }
      />
      <ProgressBar
        done={index}
        total={total}
        timeText={formatDuration(elapsed)}
        label={kind === 'review' ? '已复习' : '已练题'}
      />

      <main className="relative flex flex-1 items-center justify-center px-8">
        <div className="w-full max-w-[880px] animate-pop" key={word.id}>
          <WordSlot
            word={word.word}
            typed={typed}
            errorPos={errorPos}
            shakeKey={shakeKey}
            hint={hint}
            mode={mode}
            reveal={reveal}
            phonetic={word.phoneticUK}
            cn={cnHint}
            syllables={word.syllables}
            hideCn={listen && !cnHint}
            onSpeak={doSpeak}
          />
        </div>

        {/* 听音模式下中文被隐藏时的补充提示 */}
        {listen && !cnHint && (
          <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-muted/35">
            听发音拼出这个单词 · 连错两次会给中文提示
          </div>
        )}

        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-rise rounded-lg bg-card px-3.5 py-2 text-[12px] text-ink/85 ring-1 ring-white/10">
            {toast}
          </div>
        )}
      </main>

      <BottomBar
        onPrev={prevWord}
        onSkip={skipWord}
        onNext={skipWord}
        onReveal={doReveal}
        onMaster={doMaster}
        extra={
          <button
            onClick={doSpeak}
            title="朗读"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/[0.07] hover:text-ink"
          >
            <Volume2 size={17} strokeWidth={2} />
          </button>
        }
        hintLeft={<span className="truncate">{kind === 'review' ? '错题复习' : unit?.theme ?? ''}</span>}
      />
    </StageFrame>
  )
}

function ModeIcon({ mode }: { mode: PracticeMode }) {
  if (mode === 'listen') return <Volume2 size={12} strokeWidth={2.4} />
  if (mode === 'cloze') return <Music2 size={12} strokeWidth={2.4} />
  return <span className="text-[11px]">看</span>
}
