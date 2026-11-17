import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { Sentence } from '@/types'
import { displayChars, inputChars, isPunct, posTone, tokenFlags } from '@/core/typing'

interface Props {
  sentence: Sentence
  /** 当前正在打的词下标 */
  tokenIndex: number
  /** 当前词已敲对的字符 */
  typed: string
  /** 打错时抖动 */
  shakeKey: number
  /** 本句里打错过的词下标（一直标红，直到该词打完） */
  wrongTokens?: number[]
  /** 显示答案（揭晓态）：把还没打的词全亮出来 */
  reveal?: boolean
  /** 字号倍率（1 = 上限 64px） */
  fontScale?: number
  /** 虚拟键盘占位时收紧留白 */
  compact?: boolean
  onSpeak?: () => void
}

/** 等宽字符宽高比，用于估宽挑字号 */
const CHAR_RATIO = 0.62
/** 每个词块左右内边距 + 间隙，跟着字号走 */
const BLOCK_PAD = 46
const BLOCK_GAP = 22

/**
 * 一个词块的高度：字母行 ≈ fs，加上词性标签、中文（字号是 0.3×fs）和上下内边距。
 * 实测 fs=74 时约 134px，fs=97 时约 185px，取 fs*1.32 + 52 略偏保守。
 */
const blockHeight = (fs: number) => fs * 1.32 + 52
/** 词块折行时的行间距（对应 gap-y-8） */
const ROW_GAP = 32

const tokenWidth = (en: string, fs: number) => inputChars(en).length * CHAR_RATIO * fs + BLOCK_PAD

/** 在给定字号下，这句要折成几行 */
function linesNeeded(tokens: Sentence['tokens'], fs: number, maxWidth: number): number {
  let lines = 1
  let w = 0
  for (const t of tokens) {
    const tw = tokenWidth(t.en, fs)
    const add = w === 0 ? tw : tw + BLOCK_GAP
    if (w > 0 && w + add > maxWidth) {
      lines += 1
      w = tw
    } else {
      w += add
    }
  }
  return lines
}

/**
 * 挑字号：从上限往下试，要求行数不超过 maxLines、且总高度放得下。
 * 短句直接顶到上限；长句允许折两行换更大的字。
 */
function fitFontSize(
  tokens: Sentence['tokens'],
  maxWidth: number,
  maxHeight: number,
  cap: number,
  maxLines: number,
): number {
  for (let fs = cap; fs >= 20; fs -= 1) {
    const lines = linesNeeded(tokens, fs, maxWidth)
    if (lines > maxLines) continue
    const need = lines * blockHeight(fs) + (lines - 1) * ROW_GAP
    if (need <= maxHeight) return fs
  }
  return 20
}

export default function SentenceBoard({
  sentence,
  tokenIndex,
  typed,
  shakeKey,
  wrongTokens = [],
  reveal = false,
  fontScale = 1,
  compact = false,
  onSpeak,
}: Props) {
  const [shaking, setShaking] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!shakeKey) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 320)
    return () => clearTimeout(t)
  }, [shakeKey])

  /* 量一下词块区实际能用的宽高，字号跟着窗口和排版走 */
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** 上下留白：有键盘时收紧 */
  const pad = compact ? 14 : 34
  const usableW = Math.max(200, box.w - 64)
  const usableH = Math.max(120, box.h - pad * 2)

  /** 上限 64px × 倍率；长句允许折两行换更大的字 */
  const cap = Math.round(64 * fontScale)
  const fs = box.w ? fitFontSize(sentence.tokens, usableW, usableH, cap, 2) : 46

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
      {/* 中文整句 */}
      <h2
        key={sentence.id}
        className={clsx(
          'animate-rise shrink-0 text-center font-semibold leading-snug tracking-wide text-ink',
          compact ? 'text-[30px]' : 'text-[38px]',
        )}
      >
        {sentence.cn}
      </h2>

      {/* 听英文 */}
      <button
        onClick={onSpeak}
        className={clsx(
          'group flex shrink-0 items-center gap-2 rounded-full bg-brand/[0.13] px-5 py-2 text-[14px] font-medium text-brand/90 ring-1 ring-brand/25 transition hover:bg-brand/20 hover:text-brand hover:ring-brand/45 active:scale-[0.98]',
          compact ? 'mt-3' : 'mt-5',
        )}
        title="朗读整句英文"
      >
        <Volume2 size={16} strokeWidth={2.2} className="transition group-hover:scale-110" />
        听英文
      </button>

      {/* 词块区 —— 左右几乎撑满，上下给足留白 */}
      <div
        ref={boxRef}
        className={clsx(
          'mt-4 flex min-h-0 w-full flex-1 flex-wrap content-center items-start justify-center gap-x-[22px] gap-y-8 overflow-hidden rounded-[26px] bg-white/[0.022] px-8 ring-1 ring-white/[0.05]',
          shaking && 'animate-shake',
        )}
        style={{ paddingTop: pad, paddingBottom: pad }}
      >
        {sentence.tokens.map((t, i) => {
          const state: 'done' | 'current' | 'todo' =
            i < tokenIndex ? 'done' : i === tokenIndex ? 'current' : 'todo'
          return (
            <TokenBlock
              key={`${sentence.id}-${i}`}
              en={t.en}
              cn={t.cn}
              pos={t.pos}
              state={state}
              typed={state === 'current' ? typed : ''}
              fontSize={fs}
              reveal={reveal}
              errorFlash={state === 'current' && wrongTokens.includes(i)}
            />
          )
        })}
      </div>
    </div>
  )
}

function TokenBlock({
  en,
  cn,
  pos,
  state,
  typed,
  fontSize,
  reveal,
  errorFlash,
}: {
  en: string
  cn: string
  pos: string
  state: 'done' | 'current' | 'todo'
  typed: string
  fontSize: number
  reveal: boolean
  errorFlash: boolean
}) {
  /* 标点在界面上不出现、也不参与判定，只留字母与撇号/连字符 */
  const cells = displayChars(en)
    .map((c, i) => ({ c, typable: tokenFlags(en)[i] }))
    .filter((x) => !isPunct(x.c))
  const answer = inputChars(en)
  const tone = posTone(pos)

  /** 某一位该显示什么字母；null = 还没打出来 */
  const charAt = (idx: number): string | null => {
    if (state === 'done') return answer[idx] ?? null
    if (state === 'current') return idx < typed.length ? typed[idx] : null
    return reveal ? (answer[idx] ?? null) : null
  }

  const showCursor = state === 'current' && typed.length < answer.length
  let k = -1

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center rounded-xl px-3 pb-2 pt-2.5 transition-colors',
        errorFlash && 'bg-err/[0.1] ring-1 ring-err/60',
        !errorFlash && state === 'current' && 'bg-white/[0.06] ring-1 ring-brand/30',
        !errorFlash && state === 'todo' && 'bg-white/[0.03]',
        !errorFlash && state === 'done' && 'bg-white/[0.015]',
      )}
    >
      {/* 词性 */}
      <span
        className="mb-1.5 shrink-0 rounded-md px-1.5 py-[1.5px] text-[10.5px] leading-none tracking-wide"
        style={{ color: tone.fg, background: tone.bg }}
      >
        {pos}
      </span>

      {/* 字母槽 */}
      <div className="flex items-end" style={{ fontSize: `${fontSize}px` }}>
        {cells.map(({ c, typable }, i) => {
          /* 撇号/连字符：常亮，不占输入位 */
          if (!typable) {
            const apos = c === "'" || c === '’'
            const dash = c === '-'
            return (
              <span
                key={i}
                className="font-mono font-bold leading-none text-ink/45"
                style={{ width: dash ? '0.5em' : '0.34em' }}
              >
                {apos ? '’' : dash ? '–' : c}
              </span>
            )
          }
          k += 1
          const idx = k
          const ch = charAt(idx)
          const isCursor = showCursor && idx === typed.length

          return (
            <span
              key={i}
              className={clsx(
                'relative mx-[1px] flex items-end justify-center border-b-2 pb-[0.1em] font-mono font-bold uppercase leading-none transition-colors duration-150',
                ch && 'border-ok/55',
                isCursor && errorFlash && 'border-err',
                isCursor && !errorFlash && 'border-cursor/90',
                !ch && !isCursor && 'border-white/[0.45]',
              )}
              style={{ width: '0.62em' }}
            >
              <span className={clsx(ch ? 'text-ok' : 'text-transparent')}>{ch ?? 'X'}</span>
              {isCursor && (
                <span className="pointer-events-none absolute bottom-[0.14em] left-1/2 h-[0.76em] w-[2px] -translate-x-1/2 animate-pulse rounded-full bg-cursor/85" />
              )}
            </span>
          )
        })}
      </div>

      {/* 中文 */}
      <span
        className={clsx(
          'mt-2 max-w-[11em] truncate text-center leading-none',
          state === 'todo' ? 'text-muted/40' : 'text-muted/75',
        )}
        style={{ fontSize: `${Math.max(12, Math.round(fontSize * 0.3))}px` }}
        title={cn}
      >
        {cn}
      </span>
    </div>
  )
}
