import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { BottomBar, ProgressBar, StageFrame, TopBar } from '@/components/StageFrame'
import SentenceBoard from '@/components/SentenceBoard'
import VirtualKeyboard from '@/components/VirtualKeyboard'
import Fireworks from '@/components/Fireworks'
import { formatDuration, inputChars, isPunct } from '@/core/typing'
import { playError, playKey, playSuccess } from '@/utils/sound'
import { speak, warmupSpeech } from '@/utils/speech'
import { preloadClip } from '@/utils/voice'
import { markMastered } from '@/utils/srs'

export default function Practice({ onOpenSettings }: { onOpenSettings: () => void }) {
  const book = useApp((s) => s.book)
  const unitNo = useApp((s) => s.unitNo)
  const kind = useApp((s) => s.kind)
  const items = useApp((s) => s.items)
  const index = useApp((s) => s.index)
  const tokenIndex = useApp((s) => s.tokenIndex)
  const typed = useApp((s) => s.typed)
  const shakeKey = useApp((s) => s.shakeKey)
  const wrongTokenIdx = useApp((s) => s.wrongTokenIdx)
  const completed = useApp((s) => s.completed)
  const typeKey = useApp((s) => s.typeKey)
  const backspace = useApp((s) => s.backspace)
  const skipSentence = useApp((s) => s.skipSentence)
  const advance = useApp((s) => s.advance)
  const prevSentence = useApp((s) => s.prevSentence)
  const backToShelf = useApp((s) => s.backToShelf)

  const showKb = useApp((s) => s.kbOn)
  const setKbOn = useApp((s) => s.setKbOn)
  const enterSkip = useApp((s) => s.enterSkip)
  const sfxOk = useApp((s) => s.sfxOk)
  const sfxErr = useApp((s) => s.sfxErr)
  const sfxKey = useApp((s) => s.sfxKey)
  const keySfxOn = useApp((s) => s.keySfxOn)
  const fontScale = useApp((s) => s.fontScale)
  const setFontScale = useApp((s) => s.setFontScale)

  const [elapsed, setElapsed] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [toast, setToast] = useState('')
  const [burst, setBurst] = useState(0)
  const toastAt = useRef(0)
  const revealTimer = useRef(0)

  const unit = book?.units.find((u) => u.no === unitNo)
  /* 本轮 = 单词卡与例句交替；单词卡是 kind='word' 的伪句子 */
  const sentence = items[index]
  const total = items.length
  /** 词数和句数分开数，进度条走整轮总进度 */
  const wordTotal = items.filter((i) => i.kind === 'word').length
  const sentTotal = total - wordTotal
  const isWord = sentence?.kind === 'word'
  const wordDone = items.slice(0, index).filter((i) => i.kind === 'word').length
  const sentDone = index - wordDone
  const nextKind = items[index + 1]?.kind === 'word' ? 'word' : items[index + 1] ? 'sentence' : null
  const nextLabel = nextKind === 'word' ? '下一个词' : nextKind === 'sentence' ? '进下一句' : '看结果'

  /* 下一个该敲的键 —— 给虚拟键盘指路 */
  const token = sentence?.tokens[tokenIndex]
  const answer = token ? inputChars(token.en) : []
  const nextKey = answer[typed.length]?.toLowerCase() ?? null

  const doSpeak = () => {
    if (sentence) speak(sentence.en, { rate: 0.8 })
  }

  /** 同一句提示 2.6 秒内只弹一次，免得孩子连按空格时刷屏 */
  const say = useCallback((msg: string) => {
    const now = Date.now()
    if (now - toastAt.current < 2600) return
    toastAt.current = now
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }, [])

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
    /* 提前把当前和下一句的音频取好，点「再听一遍」时零等待 */
    preloadClip(sentence.en)
    const next = items[index + 1]
    if (next) preloadClip(next.en)
    const t = window.setTimeout(() => speak(sentence.en, { rate: 0.8 }), 240)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const doReveal = useCallback(() => {
    setReveal(true)
    window.clearTimeout(revealTimer.current)
    revealTimer.current = window.setTimeout(() => setReveal(false), 2200)
  }, [])

  const doMaster = () => {
    if (!book || !sentence) return
    markMastered(book.id, sentence.id)
    setToast('已移出错题本')
    window.setTimeout(() => setToast(''), 1600)
  }

  /** 跳过整句：受设置开关控制；关着就明确告诉孩子为什么按不动 */
  const trySkip = useCallback(() => {
    if (!enterSkip) {
      say('跳过已关闭 —— 先把这句话打完')
      return
    }
    skipSentence()
  }, [enterSkip, say, skipSentence])

  /* 键盘 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* 设置面板开着的时候，键盘归面板，别让 Esc 顺手退出练习 */
      if (useApp.getState().settingsOpen) return
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === 'Escape') return backToShelf()
      if (e.key === 'Backspace') {
        e.preventDefault()
        return backspace()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        return trySkip()
      }
      if (e.key === ' ') {
        e.preventDefault()
        /* 空格只干一件事：这句拼完了，进下一句 */
        if (completed) return advance()
        say('先把这句话拼完，再按空格进下一句')
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault()

      /* 标点不参与判定：孩子顺手打出句号/问号也不该算错，直接忽略 */
      if (isPunct(e.key)) return

      const result = typeKey(e.key)
      if (result === 'bad') {
        playError(sfxErr)
      } else if (result === 'ok' || result === 'word') {
        /* 按键音单独开关：嫌吵可以关掉，字母照样判定 */
        if (keySfxOn) playKey(sfxKey)
      } else if (result === 'done') {
        /* 不自动跳下一句：定格成彩色卡片 + 烟花，等空格 */
        playSuccess(sfxOk)
        setBurst((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    typeKey,
    backspace,
    advance,
    backToShelf,
    trySkip,
    doReveal,
    say,
    completed,
    sfxOk,
    sfxErr,
    sfxKey,
    keySfxOn,
  ])

  if (!book || !sentence) return null

  return (
    <StageFrame>
      <TopBar
        title={book.title}
        unitLabel={
          kind === 'review' ? '错题复习' : `Unit ${unitNo}${isWord ? ' · 单词' : ' · 句子'}`
        }
        onBack={backToShelf}
        onSettings={onOpenSettings}
        right={
          <button
            onClick={() => setKbOn(!showKb)}
            title={showKb ? '收起虚拟键盘' : '显示虚拟键盘与指法提示'}
            className={clsx(
              'no-drag flex h-8 w-8 items-center justify-center rounded-lg transition',
              showKb ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-veil/5 hover:text-ink',
            )}
          >
            <Keyboard size={16} strokeWidth={1.9} />
          </button>
        }
      />
      <ProgressBar
        done={index}
        total={total}
        timeText={formatDuration(elapsed)}
        label={kind === 'review' ? '已复习' : '已练'}
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
            completed={completed}
            fontScale={fontScale}
            compact={showKb && !completed}
            onSpeak={doSpeak}
          />
        </div>

        {showKb && !completed && <VirtualKeyboard nextKey={nextKey} className="mt-2" />}

        <Fireworks burst={burst} />

        {toast && (
          <div className="absolute bottom-12 left-1/2 z-40 -translate-x-1/2 animate-rise rounded-lg bg-card px-3.5 py-2 text-[12px] text-ink/85 ring-1 ring-veil/10">
            {toast}
          </div>
        )}
      </main>

      <BottomBar
        onPrev={prevSentence}
        onSkip={trySkip}
        skipDisabled={!enterSkip}
        onNext={completed ? advance : trySkip}
        nextReady={completed}
        nextLabel={completed ? nextKind === 'word' ? '下一个词' : nextKind === 'sentence' ? '下一句' : '下一题' : '下一题'}
        onReveal={doReveal}
        onMaster={doMaster}
        extra={
          <div className="mx-1.5 flex items-center gap-0.5 rounded-lg bg-veil/[0.05] px-1 py-0.5 ring-1 ring-veil/[0.07]">
            <button
              onClick={() => setFontScale(fontScale - 0.1)}
              title="字号调小"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-semibold leading-none text-muted transition hover:bg-veil/10 hover:text-ink"
            >
              A-
            </button>
            <span className="tabnum w-10 select-none text-center text-[11px] leading-none text-ink/75">
              {Math.round(fontScale * 100)}%
            </span>
            <button
              onClick={() => setFontScale(fontScale + 0.1)}
              title="字号调大"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-semibold leading-none text-muted transition hover:bg-veil/10 hover:text-ink"
            >
              A+
            </button>
          </div>
        }
        hintLeft={
          completed ? (
            <span className="flex items-center gap-1.5 text-brand">
              <span className="animate-pulse">✓</span>
              拼完了 · <kbd className="rounded bg-veil/[0.08] px-1.5 py-[2px] text-[11px]">空格</kbd>{' '}
              {nextLabel}
            </span>
          ) : (
            <span className="truncate">
              {kind === 'review' ? '错题复习' : (unit?.theme ?? '')}
              <span className="ml-2 text-muted/35">
                {kind === 'unit' && wordTotal > 0 ? (
                  <>
                    单词 {Math.min(wordDone + (isWord ? 1 : 0), wordTotal)}/{wordTotal}
                    <span className="mx-1 text-muted/25">·</span>
                    句子 {Math.min(sentDone + (isWord ? 0 : 1), sentTotal)}/{sentTotal}
                  </>
                ) : (
                  <>
                    {index + 1}/{total}
                  </>
                )}
              </span>
            </span>
          )
        }
      />
    </StageFrame>
  )
}
