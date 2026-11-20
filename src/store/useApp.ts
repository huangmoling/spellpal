import { create } from 'zustand'
import type { Book, Sentence, Word } from '@/types'
import { assignSentences } from '@/core/pairing'
import { inputChars, judgeToken, shuffle } from '@/core/typing'
import { setSfxVolume } from '@/utils/sound'
import { setSpeechVolume } from '@/utils/speech'
import { hashPin, isPin, todayStr } from '@/core/pin'

type Phase = 'idle' | 'typing' | 'done'
/** 会话类型：单元练习 / 错题复习 */
type SessionKind = 'unit' | 'review'
/** 一句的一次裁定 */
type Outcome = 'clean' | 'rough'

interface AppState {
  book: Book | null
  unitNo: number
  kind: SessionKind
  /** 本轮所有练习项：单词卡与例句交替排列。单词卡是伪句子（kind='word'） */
  items: Sentence[]
  /** 队列里是练习项 id */
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
  /** 本句已拼完，停在原地等空格（不再自动跳下一句） */
  completed: boolean
  /** 每次打错自增，用于触发抖动动画 */
  shakeKey: number
  /** 字号倍率，1 = 上限 64px，用户可在练习页调 */
  fontScale: number
  setFontScale: (v: number) => void

  /* ---- 外观与偏好 ---- */
  theme: Theme
  setTheme: (t: Theme) => void
  /** 虚拟键盘与指法提示 */
  kbOn: boolean
  setKbOn: (v: boolean) => void
  /** 回车键：跳过整句（默认关闭） */
  enterSkip: boolean
  setEnterSkip: (v: boolean) => void
  /** 拼对整句的音效序号（0-7） */
  sfxOk: number
  /** 拼错的音效序号（0-7） */
  sfxErr: number
  /** 每个字母的按键音序号（0-7） */
  sfxKey: number
  /** 按键音开关，默认开；嫌吵可以关掉 */
  keySfxOn: boolean
  /** 总音量 0–100（朗读 + 音效） */
  volume: number
  setVolume: (v: number) => void
  setSfx: (kind: 'ok' | 'err' | 'key', i: number) => void
  setKeySfxOn: (v: boolean) => void
  /** 设置面板是否打开——打开时要屏蔽练习页的全局键盘，否则 Esc 会连带退出练习 */
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void

  /* ---- 少儿守护 ---- */
  /** 守护开关：开启后启动即全屏、关窗要密码、学满时长锁定 */
  guardOn: boolean
  /** 密码散列，不存明文 */
  guardPinHash: string
  /** 家长设定的每日学习时长（分钟） */
  guardMinutes: number
  /** 今天已学秒数 */
  guardUsedSec: number
  /** 今天家长临时加时秒数 */
  guardBonusSec: number
  /** 用量所属日期，跨天自动归零 */
  guardDate: string
  /** 今天的额度已经用完 */
  guardLocked: boolean
  /** 首次开启：设密码 + 定每日时长 */
  enableGuard: (pin: string, minutes: number) => boolean
  /** 关闭守护。调用方必须先验密码 */
  disableGuard: () => void
  /** 校验 6 位密码 */
  verifyPin: (pin: string) => boolean
  /** 改每日时长。调用方必须先验密码 */
  setGuardMinutes: (m: number) => void
  /** 累计学习时长（秒），到点后自动锁定 */
  addGuardUsage: (sec: number) => void
  /** 家长临时加时（分钟） */
  extendGuard: (min: number) => void

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

/** 单词卡 id 前缀，用来和句子 id 区分 */
const WORD_PREFIX = 'w:'
export const isWordItem = (id: string) => id.startsWith(WORD_PREFIX)

/**
 * 把一个单词包成「一句话」，这样练习界面和判定逻辑都能直接复用。
 *
 * 词组（pocket money、watering can）必须按空格拆成多个词块：
 * 空格键在练习页是「进下一题」，不是输入字符，整串塞进一个词块会让
 * 判定期待的下一字符变成空格，孩子打到 "pocket" 之后怎么敲都算错。
 */
const wordCardOf = (w: Word): Sentence => {
  const cn = w.senses[0]?.cn ?? w.word
  /* 括号里是复数/变体提示（foot (feet)），不是要拼的内容 */
  const parts = w.word
    .replace(/[（(][^)）]*[)）]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return {
    id: `${WORD_PREFIX}${w.id}`,
    unit: w.unit,
    kind: 'word',
    cn,
    en: w.word,
    ipa: w.phoneticUK,
    tokens: (parts.length ? parts : [w.word]).map((en) => ({ en, cn: '', pos: '' })),
  }
}

/** id → 练习项。单词卡按 id 从 book.words 里现拼。 */
const resolveItem = (book: Book, id: string): Sentence | undefined => {
  if (isWordItem(id)) {
    const w = (book.words ?? []).find((x) => `${WORD_PREFIX}${x.id}` === id)
    return w ? wordCardOf(w) : undefined
  }
  return (book.sentences ?? []).find((s) => s.id === id)
}

/**
 * 一个单元的练习顺序：**一个单词一个句子，交替着来**。
 * 「单词：猫 cat → 语句：一只猫 A cat」是用户明确要求的顺序，不要改回「先单词后句子」。
 *
 * 句子只发给真正包含这个词的词（pocket money → I have some pocket money.），
 * 这样孩子看到「单词 → 例句」时能对上号；配不上的词就连续练，
 * 没被任何词用上的例句排在整轮最后。
 */
const itemsOfUnit = (book: Book, unitNo: number, order: 'seq' | 'random'): Sentence[] => {
  const words = (book.words ?? []).filter((w) => w.unit === unitNo)
  const sents = (book.sentences ?? []).filter((s) => s.unit === unitNo)
  const wordList = order === 'random' ? shuffle(words) : words
  const pool = order === 'random' ? shuffle(sents) : [...sents]

  const assignment = assignSentences(
    wordList.map((w) => w.word),
    pool,
  )
  const used = new Set<number>()
  /** 配到例句的词：两两成组，词后面紧跟它的例句 */
  const team: Sentence[] = []
  /** 没配到例句的词 */
  const solo: Sentence[] = []
  wordList.forEach((w, i) => {
    const j = assignment.get(i)
    if (j === undefined) {
      solo.push(wordCardOf(w))
      return
    }
    used.add(j)
    team.push(wordCardOf(w), pool[j])
  })

  /* 把「光单词」均匀插在「词+例句」之间，免得开头一串词、结尾一长串句子 */
  const out: Sentence[] = []
  const teams = team.length / 2
  let k = 0
  for (let i = 0; i < teams; i += 1) {
    out.push(team[i * 2], team[i * 2 + 1])
    const want = teams ? Math.round(((i + 1) * solo.length) / teams) : solo.length
    while (k < want) out.push(solo[k++])
  }
  while (k < solo.length) out.push(solo[k++])
  out.push(...pool.filter((_, j) => !used.has(j)))
  return out
}

/* 字号倍率持久化：0.8 – 2.0，默认 1.15 */
const FONT_KEY = 'spellpal:font'
export const FONT_MIN = 0.8
export const FONT_MAX = 2
export const FONT_DEFAULT = 1.15

const readFontScale = () => {
  const raw = Number(localStorage.getItem(FONT_KEY))
  return Number.isFinite(raw) && raw >= FONT_MIN && raw <= FONT_MAX ? raw : FONT_DEFAULT
}

/* ---------- 外观与偏好 ---------- */

export type Theme = 'dark' | 'light'

const THEME_KEY = 'spellpal:theme'
const KB_KEY = 'spellpal:kb'
const ENTER_KEY = 'spellpal:opt-enter'
const SFX_OK_KEY = 'spellpal:sfx-ok'
const SFX_ERR_KEY = 'spellpal:sfx-err'
const SFX_KEY_KEY = 'spellpal:sfx-key'
const KEYSFX_ON_KEY = 'spellpal:opt-keysfx'
const VOLUME_KEY = 'spellpal:volume'

const readTheme = (): Theme => (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark')
/** 虚拟键盘默认开；回车跳过默认关 */
const readFlag = (key: string, fallback: boolean) => {
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : raw === '1'
}
/** 音量 0–100，默认 100：朗读和音效共用一个旋钮 */
export const VOLUME_DEFAULT = 100
const VOLUME_MIGRATED = 'spellpal:volume-v2'
const readVolume = () => {
  const raw = localStorage.getItem(VOLUME_KEY)
  /* 注意 Number(null) === 0，不先判空会默认成静音 */
  if (raw === null) return VOLUME_DEFAULT
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100) return VOLUME_DEFAULT
  /* 0.9.1 之前默认 80 且整体偏轻：没动过旋钮的老用户提到 100 */
  if (!localStorage.getItem(VOLUME_MIGRATED)) {
    localStorage.setItem(VOLUME_MIGRATED, '1')
    if (n === 80) {
      localStorage.setItem(VOLUME_KEY, String(VOLUME_DEFAULT))
      return VOLUME_DEFAULT
    }
  }
  return Math.round(n)
}
/**
 * 把音量同时推给音效总线和语音合成。
 * 语音合成的 volume 上限就是 1.0，没法再放大，所以给一条下凹曲线：
 * 滑块拉到 60% 就已经接近满响度，剩下的行程用来微调小音量。
 */
export const applyVolume = (v: number) => {
  const x = Math.min(1, Math.max(0, v / 100))
  setSfxVolume(x)
  setSpeechVolume(Math.min(1, Math.pow(x, 0.45)))
}

/** 音效序号 0-7 */
const readSfx = (key: string, fallback: number) => {
  const raw = Number(localStorage.getItem(key))
  return Number.isInteger(raw) && raw >= 0 && raw <= 7 ? raw : fallback
}

/** 把主题写到 <html data-theme>，CSS 变量与 color-scheme 都靠它 */
export const applyTheme = (t: Theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = t
  /* 无边框窗口的底色也一起换，否则切主题/滚动时会闪一下另一套底色 */
  ;(window as unknown as { spellpal?: { setTheme?: (v: string) => void } }).spellpal?.setTheme?.(t)
}

/* ---------- 少儿守护 ---------- */

export const GUARD_MIN_MINUTES = 10
export const GUARD_MAX_MINUTES = 180
export const GUARD_DEFAULT_MINUTES = 30
/** 家长输密码后一次加的量 */
export const GUARD_EXTEND_MINUTES = 10

const GUARD_ON_KEY = 'spellpal:guard-on'
const GUARD_PIN_KEY = 'spellpal:guard-pin'
const GUARD_MIN_KEY = 'spellpal:guard-minutes'
const GUARD_USE_KEY = 'spellpal:guard-usage'

const clampMinutes = (n: number) =>
  Math.min(GUARD_MAX_MINUTES, Math.max(GUARD_MIN_MINUTES, Math.round(n / 5) * 5))

/** 今日用量记录，日期不是今天就直接归零 */
const readUsage = () => {
  const fresh = { date: todayStr(), sec: 0, bonus: 0 }
  try {
    const raw = JSON.parse(localStorage.getItem(GUARD_USE_KEY) || 'null') as
      | { date?: string; sec?: number; bonus?: number }
      | null
    if (!raw || raw.date !== fresh.date) return fresh
    return {
      date: fresh.date,
      sec: Math.max(0, Number(raw.sec) || 0),
      bonus: Math.max(0, Number(raw.bonus) || 0),
    }
  } catch {
    return fresh
  }
}

const persistUsage = (u: { date: string; sec: number; bonus: number }) => {
  try {
    localStorage.setItem(GUARD_USE_KEY, JSON.stringify(u))
  } catch {
    /* ignore */
  }
}

const limitOf = (minutes: number, bonus: number) => minutes * 60 + bonus
const isLocked = (on: boolean, minutes: number, u: { sec: number; bonus: number }) =>
  on && u.sec >= limitOf(minutes, u.bonus)

const readGuardOn = () => localStorage.getItem(GUARD_ON_KEY) === '1'
const readGuardPin = () => localStorage.getItem(GUARD_PIN_KEY) || ''
const readGuardMinutes = () => {
  const n = Number(localStorage.getItem(GUARD_MIN_KEY))
  return Number.isFinite(n) && n > 0 ? clampMinutes(n) : GUARD_DEFAULT_MINUTES
}

const bootUsage = readUsage()

export const useApp = create<AppState>((set, get) => ({
  book: null,
  unitNo: 1,
  kind: 'unit',
  items: [],
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
  completed: false,
  shakeKey: 0,
  fontScale: readFontScale(),

  setFontScale: (v) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 100) / 100))
    localStorage.setItem(FONT_KEY, String(next))
    set({ fontScale: next })
  },

  theme: readTheme(),
  setTheme: (t) => {
    localStorage.setItem(THEME_KEY, t)
    applyTheme(t)
    set({ theme: t })
  },

  /* 虚拟键盘默认不显示：屏幕键盘挡视线，需要的人自己到设置里打开 */
  kbOn: readFlag(KB_KEY, false),
  setKbOn: (v) => {
    localStorage.setItem(KB_KEY, v ? '1' : '0')
    set({ kbOn: v })
  },

  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  /* ---- 少儿守护 ---- */
  guardOn: readGuardOn(),
  guardPinHash: readGuardPin(),
  guardMinutes: readGuardMinutes(),
  guardUsedSec: bootUsage.sec,
  guardBonusSec: bootUsage.bonus,
  guardDate: bootUsage.date,
  guardLocked: isLocked(readGuardOn(), readGuardMinutes(), bootUsage),

  enableGuard: (pin, minutes) => {
    if (!isPin(pin)) return false
    const m = clampMinutes(minutes)
    const usage = { date: todayStr(), sec: 0, bonus: 0 }
    const h = hashPin(pin)
    try {
      localStorage.setItem(GUARD_ON_KEY, '1')
      localStorage.setItem(GUARD_PIN_KEY, h)
      localStorage.setItem(GUARD_MIN_KEY, String(m))
    } catch {
      /* ignore */
    }
    persistUsage(usage)
    set({
      guardOn: true,
      guardPinHash: h,
      guardMinutes: m,
      guardUsedSec: 0,
      guardBonusSec: 0,
      guardDate: usage.date,
      guardLocked: false,
    })
    return true
  },

  disableGuard: () => {
    try {
      localStorage.setItem(GUARD_ON_KEY, '0')
    } catch {
      /* ignore */
    }
    /* 关掉守护时清掉今日用量，下次重新开启从零算 */
    persistUsage({ date: todayStr(), sec: 0, bonus: 0 })
    set({ guardOn: false, guardLocked: false, guardUsedSec: 0, guardBonusSec: 0, guardDate: todayStr() })
  },

  verifyPin: (pin) => {
    const stored = get().guardPinHash
    if (!stored || !isPin(pin)) return false
    return hashPin(pin) === stored
  },

  setGuardMinutes: (m) => {
    const next = clampMinutes(m)
    try {
      localStorage.setItem(GUARD_MIN_KEY, String(next))
    } catch {
      /* ignore */
    }
    const s = get()
    const usage = { date: s.guardDate, sec: s.guardUsedSec, bonus: s.guardBonusSec }
    set({ guardMinutes: next, guardLocked: isLocked(s.guardOn, next, usage) })
  },

  addGuardUsage: (sec) => {
    const s = get()
    if (!s.guardOn || s.guardLocked || sec <= 0) return
    /* 跨天：昨天的秒数不带过来 */
    const sameDay = s.guardDate === todayStr()
    const usage = {
      date: todayStr(),
      sec: (sameDay ? s.guardUsedSec : 0) + sec,
      bonus: sameDay ? s.guardBonusSec : 0,
    }
    persistUsage(usage)
    set({
      guardUsedSec: usage.sec,
      guardBonusSec: usage.bonus,
      guardDate: usage.date,
      guardLocked: isLocked(true, s.guardMinutes, usage),
    })
  },

  extendGuard: (min) => {
    const s = get()
    const usage = {
      date: s.guardDate === todayStr() ? s.guardDate : todayStr(),
      sec: s.guardDate === todayStr() ? s.guardUsedSec : 0,
      bonus: (s.guardDate === todayStr() ? s.guardBonusSec : 0) + Math.max(0, min) * 60,
    }
    persistUsage(usage)
    set({
      guardUsedSec: usage.sec,
      guardBonusSec: usage.bonus,
      guardDate: usage.date,
      guardLocked: isLocked(s.guardOn, s.guardMinutes, usage),
    })
  },

  enterSkip: readFlag(ENTER_KEY, false),
  setEnterSkip: (v) => {
    localStorage.setItem(ENTER_KEY, v ? '1' : '0')
    set({ enterSkip: v })
  },

  volume: readVolume(),
  setVolume: (v) => {
    const next = Math.min(100, Math.max(0, Math.round(v)))
    localStorage.setItem(VOLUME_KEY, String(next))
    applyVolume(next)
    set({ volume: next })
  },

  sfxOk: readSfx(SFX_OK_KEY, 0),
  sfxErr: readSfx(SFX_ERR_KEY, 0),
  sfxKey: readSfx(SFX_KEY_KEY, 0),
  keySfxOn: readFlag(KEYSFX_ON_KEY, true),
  setSfx: (kind, i) => {
    const next = Math.min(7, Math.max(0, Math.round(i)))
    const store = kind === 'ok' ? SFX_OK_KEY : kind === 'err' ? SFX_ERR_KEY : SFX_KEY_KEY
    localStorage.setItem(store, String(next))
    if (kind === 'ok') set({ sfxOk: next })
    else if (kind === 'err') set({ sfxErr: next })
    else set({ sfxKey: next })
  },
  setKeySfxOn: (v) => {
    localStorage.setItem(KEYSFX_ON_KEY, v ? '1' : '0')
    set({ keySfxOn: v })
  },
  startUnit: (book, unitNo, order = 'seq') => {
    const items = itemsOfUnit(book, unitNo, order)
    if (!items.length) return
    set({
      book,
      unitNo,
      kind: 'unit',
      items,
      queue: items.map((i) => i.id),
      index: 0,
      tokenIndex: 0,
      typed: '',
      wrongTokenIdx: [],
      wrongItemIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      phase: 'typing',
      completed: false,
      shakeKey: 0,
    })
  },

  startReview: (book, sentenceIds) => {
    const items = sentenceIds
      .map((id) => resolveItem(book, id))
      .filter((x): x is Sentence => Boolean(x))
    if (!items.length) return
    set({
      book,
      unitNo: 0,
      kind: 'review',
      items,
      queue: items.map((i) => i.id),
      index: 0,
      tokenIndex: 0,
      typed: '',
      wrongTokenIdx: [],
      wrongItemIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      phase: 'typing',
      completed: false,
      shakeKey: 0,
    })
  },

  currentSentence: () => {
    const { items, index } = get()
    return items[index]
  },

  typeKey: (key) => {
    const { phase, items, index, tokenIndex, typed, startedAt, completed } = get()
    if (phase !== 'typing' || completed) return 'idle'
    const sentence = items[index]
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

    // 整句最后一个字母：就地定格成庆祝态，等空格才进下一句
    set({ typed: next, startedAt: started, completed: true })
    return 'done'
  },

  advance: () => {
    const { queue, index } = get()
    const id = queue[index]
    if (!id) return
    const outcome: Outcome = get().wrongItemIds.includes(id) ? 'rough' : 'clean'
    const outcomes = { ...get().outcomes, [id]: outcome }
    if (index >= queue.length - 1) {
      set({ phase: 'done', finishedAt: Date.now(), outcomes, completed: false })
    } else {
      set({
        index: index + 1,
        tokenIndex: 0,
        typed: '',
        wrongTokenIdx: [],
        outcomes,
        completed: false,
      })
    }
  },

  backspace: () => {
    const { tokenIndex, typed, index, items } = get()
    /* 拼完定格了就别再改字母，只能空格往下走 */
    if (get().completed) return
    if (typed.length > 0) {
      set({ typed: typed.slice(0, -1) })
      return
    }
    // 已经在这一词开头：退回上一个词，并把上一词填满
    if (tokenIndex > 0) {
      const sentence = items[index]
      const prev = sentence?.tokens[tokenIndex - 1]
      if (!prev) return
      set({
        tokenIndex: tokenIndex - 1,
        typed: inputChars(prev.en).join(''),
      })
    }
  },

  skipToken: () => {
    const { items, index, tokenIndex, startedAt } = get()
    const sentence = items[index]
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
      set({ phase: 'done', finishedAt: Date.now(), outcomes, wrongItemIds: nextWrong, completed: false })
    } else {
      set({
        index: index + 1,
        tokenIndex: 0,
        typed: '',
        wrongTokenIdx: [],
        outcomes,
        wrongItemIds: nextWrong,
        completed: false,
      })
    }
  },

  prevSentence: () => {
    const { index } = get()
    if (index > 0) set({ index: index - 1, tokenIndex: 0, typed: '', wrongTokenIdx: [], completed: false })
  },

  backToShelf: () =>
    set({
      phase: 'idle',
      book: null,
      items: [],
      queue: [],
      index: 0,
      tokenIndex: 0,
      typed: '',
      wrongTokenIdx: [],
      wrongItemIds: [],
      outcomes: {},
      startedAt: 0,
      finishedAt: 0,
      completed: false,
    }),

  elapsed: () => {
    const { startedAt, finishedAt } = get()
    if (!startedAt) return 0
    return (finishedAt || Date.now()) - startedAt
  },
}))

/* 首帧之前就把主题挂到 <html>，避免启动瞬间闪一下暗色 */
applyTheme(readTheme())
applyVolume(readVolume())

/* 开发期调试接口：便于自动化截图与手动排查 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__spellpal = {
    getState: useApp.getState,
    setState: useApp.setState,
  }
}
