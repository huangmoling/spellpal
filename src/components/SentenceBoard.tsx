import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { Sentence } from '@/types'
import {
  displayChars,
  inputChars,
  isPunct,
  posBlock,
  posTone,
  tokenFlags,
} from '@/core/typing'
import { useApp } from '@/store/useApp'

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
  /** 整句已拼完，定格成彩色卡片等空格 */
  completed?: boolean
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
 * 一个词块的高度：字母行 ≈ fs，加上词性标签、中文和上下内边距。
 * 中文默认是字号的 0.3 倍，庆祝态放大到 0.36 倍，所以要能算。
 */
const blockHeight = (fs: number, cnRatio: number) => fs * (1.02 + cnRatio) + 56
/** 词块折行时的行间距（对应 gap-y-8） */
const ROW_GAP = 32

const tokenWidth = (en: string, fs: number, pad: number) =>
  inputChars(en).length * CHAR_RATIO * fs + pad

/** 在给定字号下，这句要折成几行 */
function linesNeeded(
  tokens: Sentence['tokens'],
  fs: number,
  maxWidth: number,
  pad: number,
): number {
  let lines = 1
  let w = 0
  for (const t of tokens) {
    const tw = tokenWidth(t.en, fs, pad)
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
  cnRatio: number,
  pad: number,
): number {
  for (let fs = cap; fs >= 20; fs -= 1) {
    const lines = linesNeeded(tokens, fs, maxWidth, pad)
    if (lines > maxLines) continue
    const need = lines * blockHeight(fs, cnRatio) + (lines - 1) * ROW_GAP
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
  completed = false,
  fontScale = 1,
  compact = false,
  onSpeak,
}: Props) {
  const light = useApp((s) => s.theme) === 'light'
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

  /* 单词阶段只有一块，短，可以顶到很大；句子阶段按宽度自动降 */
  const isWord = sentence.kind === 'word'
  /* 庆祝态：中文标签放大、词块加宽，于是整句也在放得下的范围内再大一号 */
  const cnRatio = completed ? 0.36 : isWord ? 0.34 : 0.3
  const blockPad = completed ? BLOCK_PAD + 16 : BLOCK_PAD
  const cap = Math.round(64 * fontScale * (completed ? 1.14 : 1) * (isWord ? 1.45 : 1))
  const fs = box.w
    ? fitFontSize(sentence.tokens, usableW, usableH, cap, 2, cnRatio, blockPad)
    : 46

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
      {/* 中文整句 */}
      <h2
        key={sentence.id}
        className={clsx(
          'animate-rise shrink-0 text-center font-semibold leading-snug tracking-wide text-ink',
          compact ? 'text-[38px]' : 'text-[48px]',
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
          completed && 'opacity-45',
        )}
        title={isWord ? '朗读这个单词' : '朗读整句英文'}
      >
        <Volume2 size={16} strokeWidth={2.2} className="transition group-hover:scale-110" />
        {isWord ? '听发音' : '听英文'}
      </button>

      {/* 词块区 —— 左右几乎撑满，上下给足留白 */}
      <div
        ref={boxRef}
        className={clsx(
          'mt-4 flex min-h-0 w-full flex-1 flex-wrap content-center items-start justify-center gap-x-[22px] gap-y-8 overflow-hidden rounded-[26px] px-8',
          !completed && 'bg-veil/[0.022] ring-1 ring-veil/[0.05]',
          shaking && !completed && 'animate-shake',
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
              cn={isWord ? '' : t.cn}
              pos={t.pos}
              ipa={isWord ? sentence.ipa : undefined}
              state={state}
              typed={state === 'current' ? typed : ''}
              fontSize={fs}
              cnRatio={cnRatio}
              light={light}
              reveal={reveal}
              celebrate={completed}
              delay={i * 70}
              errorFlash={state === 'current' && wrongTokens.includes(i) && !completed}
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
  ipa,
  state,
  typed,
  fontSize,
  cnRatio,
  light,
  reveal,
  celebrate,
  delay,
  errorFlash,
}: {
  en: string
  cn: string
  pos: string
  /** 单词模式下用音标顶替词性标签 */
  ipa?: string
  state: 'done' | 'current' | 'todo'
  typed: string
  fontSize: number
  cnRatio: number
  light: boolean
  reveal: boolean
  celebrate: boolean
  delay: number
  errorFlash: boolean
}) {
  /* 标点在界面上不出现、也不参与判定，只留字母与撇号/连字符 */
  const cells = displayChars(en)
    .map((c, i) => ({ c, typable: tokenFlags(en)[i] }))
    .filter((x) => !isPunct(x.c))
  const answer = inputChars(en)
  const tone = posTone(pos, light)
  const grad = posBlock(pos)
  const cnSize = Math.max(12, Math.round(fontSize * cnRatio))

  /** 某一位该显示什么字母；null = 还没打出来 */
  const charAt = (idx: number): string | null => {
    if (celebrate || state === 'done') return answer[idx] ?? null
    if (state === 'current') return idx < typed.length ? typed[idx] : null
    return reveal ? (answer[idx] ?? null) : null
  }

  const showCursor = !celebrate && state === 'current' && typed.length < answer.length
  let k = -1

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center',
        celebrate ? 'rounded-2xl px-4 pb-2.5 pt-2.5' : 'rounded-xl px-3 pb-2 pt-2.5 transition-colors',
        celebrate && 'animate-celebrate',
        !celebrate && errorFlash && 'bg-err/[0.1] ring-1 ring-err/60',
        !celebrate &&
          !errorFlash &&
          state === 'current' &&
          (light ? 'bg-card shadow-sm ring-1 ring-brand/35' : 'bg-veil/[0.06] ring-1 ring-brand/30'),
        !celebrate && !errorFlash && state === 'todo' && (light ? 'bg-card/55' : 'bg-veil/[0.03]'),
        !celebrate && !errorFlash && state === 'done' && (light ? 'bg-card/30' : 'bg-veil/[0.015]'),
      )}
      style={
        celebrate
          ? {
              background: `linear-gradient(150deg, ${grad.from}, ${grad.to})`,
              animationDelay: `${delay}ms`,
              boxShadow: `0 14px 28px -16px ${grad.from}, inset 0 0 0 1px rgba(255,255,255,0.2)`,
            }
          : undefined
      }
    >
      {/* 单词模式显示音标，句子模式显示词性 */}
      <span
        className={clsx(
          'mb-1.5 shrink-0 rounded-md px-1.5 py-[1.5px] leading-none tracking-wide',
          ipa ? 'font-mono text-[13px]' : 'text-[10.5px]',
        )}
        style={
          celebrate
            ? { color: '#fff', background: 'rgba(255,255,255,0.22)' }
            : ipa
              ? { color: light ? '#475569' : '#CBD5E1', background: light ? 'rgba(71,85,105,0.10)' : 'rgba(148,163,184,0.14)' }
              : { color: tone.fg, background: tone.bg }
        }
      >
        {ipa || pos}
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
                className={clsx(
                  'font-mono font-bold leading-none',
                  celebrate ? 'text-white/85' : 'text-ink/45',
                )}
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

          if (celebrate) {
            return (
              <span
                key={i}
                className="mx-[1px] flex items-end justify-center pb-[0.06em] font-mono font-bold leading-none text-white"
                style={{ width: '0.62em', textShadow: '0 2px 8px rgba(0,0,0,0.28)' }}
              >
                {ch ?? ''}
              </span>
            )
          }

          return (
            <span
              key={i}
              className={clsx(
                'relative mx-[1px] flex items-end justify-center border-b-2 pb-[0.1em] font-mono font-bold uppercase leading-none transition-colors duration-150',
                ch && 'border-ok/55',
                isCursor && errorFlash && 'border-err',
                isCursor && !errorFlash && 'border-cursor/90',
                !ch && !isCursor && 'hairline',
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

      {/* 中文（单词模式下标题已经写了中文，这里不再重复） */}
      {cn && (
        <span
          className={clsx(
            'max-w-[11em] truncate text-center leading-none',
            celebrate ? 'mt-1.5 text-white/[0.94]' : 'mt-2',
            !celebrate && (state === 'todo' ? 'text-muted/40' : 'text-muted/75'),
          )}
          style={{
            fontSize: `${cnSize}px`,
            textShadow: celebrate ? '0 1px 4px rgba(0,0,0,0.25)' : undefined,
          }}
          title={cn}
        >
          {cn}
        </span>
      )}
    </div>
  )
}
