import { create } from 'zustand'
import type { Book } from '@/types'
import { judgeSeq, seqFor, shuffle, type PracticeMode } from '@/core/typing'

type Phase = 'idle' | 'typing' | 'done'
/** 会话类型：单元练习 / 错题复习 */
type SessionKind = 'unit' | 'review'
/** 单词的一次裁定 */
type Outcome = 'clean' | 'rough'

const MODE_KEY = 'spellpal:mode'

function readMode(): PracticeMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'look' || v === 'listen' || v === 'cloze') return v
  } catch {
    /* ignore */
  }
  return 'look'
}

interface AppState {
  book: Book | null
  unitNo: number
  kind: SessionKind
  mode: PracticeMode
  queue: string[]
  index: number
  typed: string
  /** 当前词里打错过的槽位（0 基，按显示序列计） */
  wrongSlots: number[]
  /** 整轮打错/跳过的词 id */
  wrongWordIds: string[]
  /** 每个词的裁定，用于写入错题本 */
  outcomes: Record<string, Outcome>
  startedAt: number
  finishedAt: number
  phase: Phase
  /** 每次打错自增，用于触发抖动动画 */
  shakeKey: number
  hint: boolean

  startUnit: (book: Book, unitNo: number, order?: 'seq' | 'random') => void
  startReview: (book: Book, wordIds: string[]) => void
  setMode: (m: PracticeMode) => void
  typeKey: (key: string) => 'ok' | 'bad' | 'done' | 'idle'
  backspace: () => void
  completeWord: () => void
  skipWord: () => void
  prevWord: () => void
  toggleHint: () => void
  backToShelf: () => void
  currentWordId: () => string | undefined
  /** 当前模式下的目标字符序列 */
  seq: () => string[]
  elapsed: () => number
}

export const useApp = create<AppState>((set, get) => ({
  book: null,
  unitNo: 1,
  kind: 'unit',
  mode: readMode(),
  queue: [],
  index: 0,
  typed: '',
  wrongSlots: [],
  wrongWordIds: [],
  outcomes: {},
  startedAt: 0,
  finishedAt: 0,
  phase: 'idle',
  shakeKey: 0,
  hint: true,

  startUnit: (book, unitNo, order = 'seq') => {
    const unit = book.units.find((u) => u.no === unitNo)
    if (!unit) return
    const ids = order === 'random' ? shuffle(unit.wordIds) : [...unit.wordIds]
    set({
      book,
      unitNo,
      kind: 'unit',
      queue: ids,
      index: 0,
      typed: '',
      wrongSlots: [],
      wrongWordIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      phase: 'typing',
      shakeKey: 0,
    })
  },

  startReview: (book, wordIds) => {
    if (!wordIds.length) return
    set({
      book,
      unitNo: 0,
      kind: 'review',
      queue: [...wordIds],
      index: 0,
      typed: '',
      wrongSlots: [],
      wrongWordIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      phase: 'typing',
      shakeKey: 0,
    })
  },

  setMode: (m) => {
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* ignore */
    }
    set({ mode: m })
  },

  seq: () => {
    const { book, queue, index, mode } = get()
    const word = book?.words.find((w) => w.id === queue[index])
    return word ? seqFor(word.word, mode) : []
  },

  typeKey: (key) => {
    const { phase, queue, index, typed, book, startedAt, mode } = get()
    if (phase !== 'typing' || !book) return 'idle'
    const id = queue[index]
    const word = book.words.find((w) => w.id === id)
    if (!word) return 'idle'

    const started = startedAt || Date.now()
    const seq = seqFor(word.word, mode)
    const ok = judgeSeq(seq, typed, key)

    if (!ok) {
      const pos = typed.length
      set((s) => ({
        startedAt: started,
        wrongSlots: s.wrongSlots.includes(pos) ? s.wrongSlots : [...s.wrongSlots, pos],
        shakeKey: s.shakeKey + 1,
        wrongWordIds: s.wrongWordIds.includes(id) ? s.wrongWordIds : [...s.wrongWordIds, id],
      }))
      return 'bad'
    }

    const next = typed + key
    set({ typed: next, startedAt: started })
    return next.length >= seq.length ? 'done' : 'ok'
  },

  backspace: () => set((s) => ({ typed: s.typed.slice(0, -1) })),

  completeWord: () => {
    const { index, queue, wrongWordIds } = get()
    const id = queue[index]
    const outcome: Outcome = wrongWordIds.includes(id) ? 'rough' : 'clean'
    const outcomes = { ...get().outcomes, [id]: outcome }
    if (index >= queue.length - 1) {
      set({ phase: 'done', finishedAt: Date.now(), outcomes })
    } else {
      set({ index: index + 1, typed: '', wrongSlots: [], outcomes })
    }
  },

  skipWord: () => {
    const { index, queue, wrongWordIds } = get()
    const id = queue[index]
    const outcomes = { ...get().outcomes, [id]: 'rough' as Outcome }
    const nextWrong = wrongWordIds.includes(id) ? wrongWordIds : [...wrongWordIds, id]
    if (index >= queue.length - 1) {
      set({ phase: 'done', finishedAt: Date.now(), outcomes, wrongWordIds: nextWrong })
    } else {
      set({
        index: index + 1,
        typed: '',
        wrongSlots: [],
        outcomes,
        wrongWordIds: nextWrong,
      })
    }
  },

  prevWord: () => {
    const { index } = get()
    if (index > 0) set({ index: index - 1, typed: '', wrongSlots: [] })
  },

  toggleHint: () => set((s) => ({ hint: !s.hint })),

  backToShelf: () =>
    set({
      phase: 'idle',
      book: null,
      queue: [],
      index: 0,
      typed: '',
      wrongSlots: [],
      wrongWordIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
    }),

  currentWordId: () => get().queue[get().index],

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
