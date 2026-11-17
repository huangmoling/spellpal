import { create } from 'zustand'
import type { Book, Sentence } from '@/types'
import { inputChars, judgeToken, shuffle } from '@/core/typing'

type Phase = 'idle' | 'typing' | 'done'
/** 会话类型：单元练习 / 错题复习 */
type SessionKind = 'unit' | 'review'
/** 一句的一次裁定 */
type Outcome = 'clean' | 'rough'

interface AppState {
  book: Book | null
  unitNo: number
  kind: SessionKind
  /** 队列里是句子 id */
  queue: string[]
  /** 当前第几句 */
  index: number
  /** 当前句里正在打的第几个词 */
  tokenIndex: number
  /** 当前词已敲对的字符（不含自动跳过的撇号/连字符） */
  typed: string
  /** 本句打错过的词下标 */
  wrongTokenIdx: number[]
  /** 整轮打错或跳过的句子 id */
  wrongItemIds: string[]
  /** 每句的裁定，用于写入错题本 */
  outcomes: Record<string, Outcome>
  startedAt: number
  finishedAt: number
  phase: Phase
  /** 每次打错自增，用于触发抖动动画 */
  shakeKey: number
  /** 字号倍率，1 = 上限 64px，用户可在练习页调 */
  fontScale: number
  setFontScale: (v: number) => void

  startUnit: (book: Book, unitNo: number, order?: 'seq' | 'random') => void
  startReview: (book: Book, sentenceIds: string[]) => void
  typeKey: (key: string) => 'ok' | 'word' | 'bad' | 'done' | 'idle'
  backspace: () => void
  /** 当前句打完（或跳过）后推进到下一句 */
  advance: () => void
  /** 空格：补全当前词并前进 */
  skipToken: () => void
  /** Enter：跳过整句 */
  skipSentence: () => void
  prevSentence: () => void
  backToShelf: () => void
  currentSentence: () => Sentence | undefined
  elapsed: () => number
}

const sentenceIdsOf = (book: Book, unitNo: number) =>
  (book.sentences ?? []).filter((s) => s.unit === unitNo).map((s) => s.id)

/* 字号倍率持久化：0.8 – 1.6，默认 1.15 */
const FONT_KEY = 'spellpal:font'
export const FONT_MIN = 0.8
export const FONT_MAX = 1.6
export const FONT_DEFAULT = 1.15

const readFontScale = () => {
  const raw = Number(localStorage.getItem(FONT_KEY))
  return Number.isFinite(raw) && raw >= FONT_MIN && raw <= FONT_MAX ? raw : FONT_DEFAULT
}

export const useApp = create<AppState>((set, get) => ({
  book: null,
  unitNo: 1,
  kind: 'unit',
  queue: [],
  index: 0,
  tokenIndex: 0,
  typed: '',
  wrongTokenIdx: [],
  wrongItemIds: [],
  outcomes: {},
  startedAt: 0,
  finishedAt: 0,
  phase: 'idle',
  shakeKey: 0,
  fontScale: readFontScale(),

  setFontScale: (v) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 100) / 100))
    localStorage.setItem(FONT_KEY, String(next))
    set({ fontScale: next })
  },

  startUnit: (book, unitNo, order = 'seq') => {
    const ids = sentenceIdsOf(book, unitNo)
    if (!ids.length) return
    set({
      book,
      unitNo,
      kind: 'unit',
      queue: order === 'random' ? shuffle(ids) : ids,
      index: 0,
      tokenIndex: 0,
      typed: '',
      wrongTokenIdx: [],
      wrongItemIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      phase: 'typing',
      shakeKey: 0,
    })
  },

  startReview: (book, sentenceIds) => {
    if (!sentenceIds.length) return
    set({
      book,
      unitNo: 0,
      kind: 'review',
      queue: [...sentenceIds],
      index: 0,
      tokenIndex: 0,
      typed: '',
      wrongTokenIdx: [],
      wrongItemIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      phase: 'typing',
      shakeKey: 0,
    })
  },

  currentSentence: () => {
    const { book, queue, index } = get()
    const id = queue[index]
    return book?.sentences?.find((s) => s.id === id)
  },

  typeKey: (key) => {
    const { phase, book, queue, index, tokenIndex, typed, startedAt } = get()
    if (phase !== 'typing' || !book) return 'idle'
    const sentence = book.sentences?.find((s) => s.id === queue[index])
    if (!sentence) return 'idle'
    const token = sentence.tokens[tokenIndex]
    if (!token) return 'idle'

    const started = startedAt || Date.now()

    if (!judgeToken(token.en, typed, key)) {
      set((s) => ({
        startedAt: started,
        shakeKey: s.shakeKey + 1,
        wrongTokenIdx: s.wrongTokenIdx.includes(tokenIndex)
          ? s.wrongTokenIdx
          : [...s.wrongTokenIdx, tokenIndex],
        wrongItemIds: s.wrongItemIds.includes(sentence.id)
          ? s.wrongItemIds
          : [...s.wrongItemIds, sentence.id],
      }))
      return 'bad'
    }

    const next = typed + key
    const full = inputChars(token.en).length

    // 当前词还没打完
    if (next.length < full) {
      set({ typed: next, startedAt: started })
      return 'ok'
    }

    // 当前词打完了：后面还有词就自动跳到下一个
    if (tokenIndex < sentence.tokens.length - 1) {
      set({ typed: '', tokenIndex: tokenIndex + 1, startedAt: started })
      return 'word'
    }

    // 整句最后一个字母 —— 保留完整显示，由界面在短暂停顿后调用 advance()
    set({ typed: next, startedAt: started })
    return 'done'
  },

  advance: () => {
    const { queue, index } = get()
    const id = queue[index]
    if (!id) return
    const outcome: Outcome = get().wrongItemIds.includes(id) ? 'rough' : 'clean'
    const outcomes = { ...get().outcomes, [id]: outcome }
    if (index >= queue.length - 1) {
      set({ phase: 'done', finishedAt: Date.now(), outcomes })
    } else {
      set({ index: index + 1, tokenIndex: 0, typed: '', wrongTokenIdx: [], outcomes })
    }
  },

  backspace: () => {
    const { tokenIndex, typed, index, book, queue } = get()
    if (typed.length > 0) {
      set({ typed: typed.slice(0, -1) })
      return
    }
    // 已经在这一词开头：退回上一个词，并把上一词填满
    if (tokenIndex > 0) {
      const sentence = book?.sentences?.find((s) => s.id === queue[index])
      const prev = sentence?.tokens[tokenIndex - 1]
      if (!prev) return
      set({
        tokenIndex: tokenIndex - 1,
        typed: inputChars(prev.en).join(''),
      })
    }
  },

  skipToken: () => {
    const { book, queue, index, tokenIndex, startedAt } = get()
    const sentence = book?.sentences?.find((s) => s.id === queue[index])
    if (!sentence) return
    const token = sentence.tokens[tokenIndex]
    if (!token) return

    const filled = inputChars(token.en).join('')
    const started = startedAt || Date.now()
    const nextWrong = get().wrongItemIds.includes(sentence.id)
      ? get().wrongItemIds
      : [...get().wrongItemIds, sentence.id]

    // 后面还有词：放弃当前词，进入下一个
    if (tokenIndex < sentence.tokens.length - 1) {
      set({ typed: '', tokenIndex: tokenIndex + 1, startedAt: started, wrongItemIds: nextWrong })
      return
    }

    // 已经是本句最后一个词：整句收尾并推进
    set({ typed: filled, startedAt: started, wrongItemIds: nextWrong })
    get().advance()
  },

  skipSentence: () => {
    const { index, queue, wrongItemIds } = get()
    const id = queue[index]
    if (!id) return
    const outcomes = { ...get().outcomes, [id]: 'rough' as Outcome }
    const nextWrong = wrongItemIds.includes(id) ? wrongItemIds : [...wrongItemIds, id]
    if (index >= queue.length - 1) {
      set({ phase: 'done', finishedAt: Date.now(), outcomes, wrongItemIds: nextWrong })
    } else {
      set({
        index: index + 1,
        tokenIndex: 0,
        typed: '',
        wrongTokenIdx: [],
        outcomes,
        wrongItemIds: nextWrong,
      })
    }
  },

  prevSentence: () => {
    const { index } = get()
    if (index > 0) set({ index: index - 1, tokenIndex: 0, typed: '', wrongTokenIdx: [] })
  },

  backToShelf: () =>
    set({
      phase: 'idle',
      book: null,
      queue: [],
      index: 0,
      tokenIndex: 0,
      typed: '',
      wrongTokenIdx: [],
      wrongItemIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
    }),

  elapsed: () => {
    const { startedAt, finishedAt } = get()
    if (!startedAt) return 0
    return (finishedAt || Date.now()) - startedAt
  },
}))

/* 开发期调试接口：便于自动化截图与手动排查 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__spellpal = {
    getState: useApp.getState,
    setState: useApp.setState,
  }
}
