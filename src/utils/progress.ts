/** 学习进度（localStorage，轻量、无需 IndexedDB） */

const KEY = 'spellpal:progress'
const DAY_KEY = 'spellpal:days'

export interface UnitProgress {
  /** 该单元完成过的最大题数 */
  done: number
  /** 最近一次正确率 0–100 */
  acc: number
  /** 最近一次完成时间 */
  at: number
  /** 累计练习次数 */
  times: number
}

type ProgressMap = Record<string, UnitProgress>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

const unitKey = (bookId: string, unitNo: number) => `${bookId}#${unitNo}`

export function loadProgress(): ProgressMap {
  return read<ProgressMap>(KEY, {})
}

export function getUnitProgress(bookId: string, unitNo: number): UnitProgress | undefined {
  return loadProgress()[unitKey(bookId, unitNo)]
}

export function saveUnitProgress(
  bookId: string,
  unitNo: number,
  data: { done: number; acc: number },
) {
  const all = loadProgress()
  const k = unitKey(bookId, unitNo)
  const prev = all[k]
  all[k] = {
    done: Math.max(prev?.done ?? 0, data.done),
    acc: data.acc,
    at: Date.now(),
    times: (prev?.times ?? 0) + 1,
  }
  write(KEY, all)
  markToday()
}

/* ---------- 打卡 ---------- */

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function markToday() {
  const days = read<string[]>(DAY_KEY, [])
  const t = todayStr()
  if (!days.includes(t)) {
    days.push(t)
    write(DAY_KEY, days)
  }
}

/** 连续练习天数（含今天；今天没练则从昨天往前数） */
export function streakDays(): number {
  const days = new Set(read<string[]>(DAY_KEY, []))
  if (days.size === 0) return 0
  const one = 86400000
  const now = new Date()
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (!days.has(todayStr())) cursor -= one
  let n = 0
  for (;;) {
    const d = new Date(cursor)
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!days.has(s)) break
    n += 1
    cursor -= one
  }
  return n
}

/** 今日是否练过 */
export function practicedToday(): boolean {
  return read<string[]>(DAY_KEY, []).includes(todayStr())
}
