/**
 * 拼写判定核心 —— 纯函数，无副作用，可单测
 *
 * 规则：
 * 1. 大小写不敏感（孩子不要求按 Shift）
 * 2. 撇号自动跳过（o'clock 只需打 oclock），显示时撇号常亮
 * 3. 空格必须自己打（red panda），训练词组意识
 * 4. 打错不前进，只标记该位置为错误并抖动
 *
 * 三种练习模式的差别只在「需要敲哪些字母」：
 *   look   看中打英 —— 整个词都要敲
 *   listen 听音拼写 —— 整个词都要敲（不给中文）
 *   cloze  挖空默写 —— 只敲挖掉的部分（默认挖元音）
 */

export type PracticeMode = 'look' | 'listen' | 'cloze'

export const MODES: { key: PracticeMode; label: string; hint: string }[] = [
  { key: 'look', label: '看中打英', hint: '看中文，敲英文' },
  { key: 'listen', label: '听音拼写', hint: '听发音，敲英文' },
  { key: 'cloze', label: '挖空默写', hint: '补全被挖掉的字母' },
]

const VOWELS = 'aeiou'

/** 不需要用户敲的装饰字符：撇号、连字符 */
const SKIP = new Set(["'", '’', '-'])

/** 去掉撇号/连字符后，真正需要用户敲的字符序列 */
export function inputChars(target: string): string[] {
  return [...target].filter((c) => !SKIP.has(c))
}

/** 用于渲染的字符序列（保留撇号与连字符） */
export function displayChars(target: string): string[] {
  return [...target]
}

/** 与 displayChars(target) 逐位对齐：true 表示这一位需要用户敲 */
export function blankFlags(target: string, mode: PracticeMode = 'look'): boolean[] {
  const chars = displayChars(target)
  if (mode !== 'cloze') {
    return chars.map((c) => !SKIP.has(c))
  }
  // 挖空默写：挖掉元音，保留辅音骨架
  const flags = chars.map((c) => !SKIP.has(c) && VOWELS.includes(c.toLowerCase()))
  if (flags.some(Boolean)) return flags
  // 没有元音（如 my / cry / sky）：挖掉中间那一个可敲字符
  const idx = Math.max(0, Math.floor(inputChars(target).length / 2))
  let seen = -1
  return chars.map((c) => {
    if (SKIP.has(c)) return false
    seen += 1
    return seen === idx
  })
}

/** 当前模式真正要敲的字符序列 */
export function seqFor(target: string, mode: PracticeMode = 'look'): string[] {
  const chars = displayChars(target)
  const flags = blankFlags(target, mode)
  return chars.filter((_, i) => flags[i])
}

/** 判断这一次按键是否命中当前待输入位置 */
export function judgeSeq(seq: string[], typed: string, key: string): boolean {
  const expected = seq[typed.length]
  if (expected === undefined) return false
  return key.toLowerCase() === expected.toLowerCase()
}

/** 兼容旧签名：整词判定 */
export function judge(target: string, typed: string, key: string): boolean {
  return judgeSeq(inputChars(target), typed, key)
}

/** 计算每个显示字符的槽位状态 */
export function slotStates(target: string, typedLength: number): ('pending' | 'correct' | 'cursor')[] {
  const chars = displayChars(target)
  let consumed = 0
  return chars.map((c) => {
    if (c === "'" || c === '’') return 'correct'
    if (consumed < typedLength) {
      consumed++
      return 'correct'
    }
    if (consumed === typedLength) {
      consumed++
      return 'cursor'
    }
    return 'pending'
  })
}

/** 完成度 0–1 */
export function progress(target: string, typed: string, mode: PracticeMode = 'look'): number {
  const total = seqFor(target, mode).length
  if (total === 0) return 1
  return Math.min(1, typed.length / total)
}

/** 打乱数组（Fisher–Yates），seed 可选以便复现 */
export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = [...arr]
  let s = seed % 2147483647
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 数字转中文（复习卡计数等场景） */
export function cnNum(n: number): string {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 10) return d[n]
  if (n < 20) return '十' + d[n - 10]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return d[t] + '十' + (o ? d[o] : '')
  }
  return String(n)
}
