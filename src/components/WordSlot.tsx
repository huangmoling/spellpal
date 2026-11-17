import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { blankFlags, seqFor, type PracticeMode } from '@/core/typing'

interface Props {
  word: string
  typed: string
  errorPos: number | null
  shakeKey: number
  hint: boolean
  mode?: PracticeMode
  /** 显示答案（揭晓态） */
  reveal?: boolean
  /** 音标 */
  phonetic?: string
  /** 中文提示 */
  cn?: string
  syllables?: string[]
  /** 听音模式：隐藏中文，只留发音按钮 */
  hideCn?: boolean
  onSpeak?: () => void
}

export default function WordSlot({
  word,
  typed,
  errorPos,
  shakeKey,
  hint,
  mode = 'look',
  reveal = false,
  phonetic,
  cn,
  syllables,
  hideCn = false,
  onSpeak,
}: Props) {
  const flags = blankFlags(word, mode)
  const chars = [...word]
  const need = seqFor(word, mode)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (!shakeKey) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 300)
    return () => clearTimeout(t)
  }, [shakeKey])

  const multiSyl = syllables && syllables.length > 1
  const cloze = mode === 'cloze'
  let k = -1

  return (
    <div className="flex w-full flex-col items-center">
      {/* 中文提示 / 发音按钮 */}
      {hideCn ? (
        <button
          onClick={onSpeak}
          className="group flex flex-col items-center gap-3 rounded-2xl px-8 py-3 transition hover:bg-white/[0.03]"
          title="再听一遍"
        >
          <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/30 transition group-hover:bg-brand/25 group-active:scale-95">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </span>
          <span className="text-[12px] text-muted/50">点这里再听一遍</span>
        </button>
      ) : (
        cn && (
          <div
            key={word}
            className="animate-rise text-center text-[52px] font-semibold leading-tight tracking-wide text-ink"
          >
            {cn}
          </div>
        )
      )}

      {/* 音节切分 */}
      <div className={clsx('h-[18px]', hideCn ? 'mt-1' : 'mt-2.5')}>
        {multiSyl && (
          <span className="text-[12px] tracking-[0.32em] text-muted/45">
            {syllables!.join(' · ')}
          </span>
        )}
      </div>

      {/* 字母槽 */}
      <div className={clsx('mt-9 flex items-end justify-center', shaking && 'animate-shake')}>
        {chars.map((c, i) => {
          /* 不需要敲的字符：撇号、连字符、以及挖空模式下的辅音骨架 */
          if (!flags[i]) {
            if (c === "'" || c === '’') {
              return (
                <span
                  key={i}
                  className="mx-[1px] self-end pb-[9px] font-mono text-[42px] font-bold leading-none text-ink/40"
                >
                  ’
                </span>
              )
            }
            if (c === '-') {
              return (
                <span
                  key={i}
                  className="mx-[2px] self-end pb-[19px] font-mono text-[34px] font-bold leading-none text-ink/35"
                >
                  –
                </span>
              )
            }
            return (
              <span
                key={i}
                className={clsx(
                  'mx-[4px] flex items-end justify-center pb-[7px] font-mono text-[58px] font-bold uppercase leading-none',
                  c === ' ' ? 'w-[26px]' : 'w-[42px]',
                  'text-ink/45',
                )}
              >
                {c === ' ' ? '' : c}
              </span>
            )
          }

          k += 1
          const pos = k
          const filled = pos < typed.length
          const isCursor = pos === typed.length
          const isWrong = errorPos === pos && !filled
          /* 提示只透露第一个要敲的字母，不能直接给出下一个答案 */
          const showHint = hint && pos === 0 && !filled
          const showAnswer = reveal && !filled

          return (
            <div
              key={i}
              className={clsx(
                'relative mx-[4px] flex items-end justify-center border-b-2 pb-[7px] transition-colors duration-150',
                c === ' ' ? 'w-[26px]' : 'w-[42px]',
                filled && 'border-ok/55',
                isCursor && !isWrong && 'border-cursor/75',
                isWrong && 'border-err',
                !filled && !isCursor && 'border-white/[0.2]',
              )}
            >
              {c === ' ' ? (
                <span
                  className={clsx(
                    'mb-[18px] h-[6px] w-[6px] rounded-full',
                    filled ? 'bg-ok/70' : 'bg-transparent',
                  )}
                />
              ) : (
                <span
                  className={clsx(
                    'font-mono text-[58px] font-bold uppercase leading-none',
                    filled
                      ? 'text-ok'
                      : isWrong
                        ? 'text-err'
                        : showAnswer
                          ? 'text-muted/75'
                          : 'text-transparent',
                  )}
                >
                  {filled ? typed[pos] : showHint || showAnswer ? c.toUpperCase() : 'X'}
                </span>
              )}

              {showHint && (
                <span className="pointer-events-none absolute inset-x-0 bottom-[7px] -z-10 font-mono text-[58px] font-bold uppercase leading-none text-white/[0.12]">
                  {c}
                </span>
              )}

              {isCursor && !filled && !showHint && (
                <span className="pointer-events-none absolute bottom-[9px] left-1/2 h-[46px] w-[2px] -translate-x-1/2 animate-pulse rounded-full bg-cursor/80" />
              )}
            </div>
          )
        })}
      </div>

      {/* 音标 + 进度 */}
      <div className="mt-7 flex items-baseline gap-3 text-[13px] text-muted/65">
        {cloze ? (
          <span className="text-[12px] text-muted/45">
            已填 {typed.length}/{need.length} 个字母
          </span>
        ) : (
          <>
            <span className="font-mono">{phonetic}</span>
            <span className="h-3 w-px self-center bg-white/10" />
            <span className="tabnum">
              {typed.length} / {need.length}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
