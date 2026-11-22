/**
 * 拼写判定核心 —— 纯函数，无副作用，可单测
 *
 * 练习单位是「句」，逐词推进。每个词块内的判定规则：
 * 1. 大小写不敏感（孩子不要求按 Shift）
 * 2. 撇号、连字符自动跳过（o'clock 只需打 oclock，Let's 只需打 Lets），显示时常亮
 * 3. 标点（. ? ! , …）不参与判定：界面上照样显示，但不占输入位，孩子不用打
 * 4. 打错不前进，只标记并抖动
 */

/**
 * 不需要用户敲的装饰字符：撇号、连字符、各种标点，以及空格。
 * 标点只在界面上展示，不参与判定；空格更特殊——空格键在练习页是「进下一题」，
 * 所以词块里即使混进空格也不能算输入位，否则整题会卡死打不下去。
 */
const SKIP = new Set([
  "'",
  '’',
  '-',
  '.',
  ',',
  '?',
  '!',
  ';',
  ':',
  '"',
  '“',
  '”',
  '(',
  ')',
  '…',
  ' ',
  '\u00a0',
])

/** 是否标点（展示用，不带下划线） */
export function isPunct(c: string): boolean {
  return SKIP.has(c) && c !== "'" && c !== '’' && c !== '-'
}

/** 该字符是否要用户敲 */
export function isTypable(c: string): boolean {
  return !SKIP.has(c)
}

/** 去掉撇号/连字符后，真正需要用户敲的字符序列 */
export function inputChars(target: string): string[] {
  return [...target].filter(isTypable)
}

/** 用于渲染的字符序列（保留撇号与连字符） */
export function displayChars(target: string): string[] {
  return [...target]
}

/** 与 displayChars(target) 逐位对齐：true 表示这一位需要用户敲 */
export function tokenFlags(target: string): boolean[] {
  return displayChars(target).map(isTypable)
}

/** 一个字块要敲的字符数 */
export function tokenLength(target: string): number {
  return inputChars(target).length
}

/** 判断这一次按键是否命中当前待输入位置 */
export function judgeToken(target: string, typed: string, key: string): boolean {
  const seq = inputChars(target)
  const expected = seq[typed.length]
  if (expected === undefined) return false
  return key.toLowerCase() === expected.toLowerCase()
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

/**
 * 词性 → 配色。暖色给动词，冷色给名词/代词，绿色给形容词。
 * 两套：暗色主题用高亮前景，浅色主题必须换成深色前景，否则在白底上是一片糊。
 */
const POS_TONE: { match: RegExp; fg: string; bg: string; fgL: string; bgL: string }[] = [
  { match: /动词|助动词/, fg: '#FCA5A5', bg: 'rgba(248,113,113,0.16)', fgL: '#B91C1C', bgL: 'rgba(220,38,38,0.11)' },
  { match: /形容词/, fg: '#6EE7B7', bg: 'rgba(52,211,153,0.14)', fgL: '#047857', bgL: 'rgba(5,150,105,0.11)' },
  { match: /名词/, fg: '#C4B5FD', bg: 'rgba(167,139,250,0.16)', fgL: '#6D28D9', bgL: 'rgba(124,58,237,0.10)' },
  { match: /副词/, fg: '#67E8F9', bg: 'rgba(34,211,238,0.14)', fgL: '#0E7490', bgL: 'rgba(14,116,144,0.10)' },
  { match: /代词/, fg: '#93C5FD', bg: 'rgba(96,165,250,0.16)', fgL: '#1D4ED8', bgL: 'rgba(37,99,235,0.10)' },
  { match: /冠词|限定词/, fg: '#A5B4FC', bg: 'rgba(129,140,248,0.16)', fgL: '#4338CA', bgL: 'rgba(79,70,229,0.10)' },
  { match: /介词|连词/, fg: '#FCD34D', bg: 'rgba(251,191,36,0.14)', fgL: '#B45309', bgL: 'rgba(180,83,9,0.10)' },
  { match: /数词/, fg: '#FDE68A', bg: 'rgba(253,224,71,0.14)', fgL: '#A16207', bgL: 'rgba(161,98,7,0.10)' },
  { match: /感叹/, fg: '#F9A8D4', bg: 'rgba(244,114,182,0.16)', fgL: '#BE185D', bgL: 'rgba(190,24,93,0.10)' },
]

export function posTone(pos: string, light = false): { fg: string; bg: string } {
  const hit = POS_TONE.find((p) => p.match.test(pos))
  if (!hit) {
    return light
      ? { fg: '#475569', bg: 'rgba(71,85,105,0.10)' }
      : { fg: '#CBD5E1', bg: 'rgba(148,163,184,0.14)' }
  }
  return light ? { fg: hit.fgL, bg: hit.bgL } : { fg: hit.fg, bg: hit.bg }
}

/**
 * 拼完之后词块整块变成彩色卡片，配色按词性分。
 * 明度都压得住白字，所以卡面上不用再分主题。
 */
/*
 * 拼完时词块会变成实色卡片。to 不能压得太暗 —— 以前名词收到 #1C3FA8、
 * 兜底干脆是 #334155，一屏彩色中间杵着一块近黑，儿童界面看着发闷。
 * 现在每条都保持「明亮糖果色」，深浅差只用来做渐变方向。
 */
const POS_BLOCK: { match: RegExp; from: string; to: string }[] = [
  { match: /系动词/, from: '#C24FE0', to: '#9B2BC4' },
  { match: /助动词|动词/, from: '#F0527F', to: '#C42A5C' },
  { match: /形容词/, from: '#F5AC2B', to: '#D9860E' },
  { match: /副词/, from: '#2FB6C9', to: '#0E93A3' },
  { match: /代词/, from: '#4C9FE8', to: '#1C74BC' },
  { match: /名词/, from: '#5286F0', to: '#2A5FCB' },
  { match: /冠词|限定词/, from: '#6E93F5', to: '#3F68CF' },
  { match: /介词|连词/, from: '#A968E8', to: '#7A35C4' },
  { match: /数词/, from: '#E5B62A', to: '#B98A0E' },
  { match: /感叹/, from: '#F0509E', to: '#C42878' },
]

export function posBlock(pos: string): { from: string; to: string } {
  const hit = POS_BLOCK.find((p) => p.match.test(pos))
  /* 单词卡没有词性，走品牌蓝，别再用近黑的蓝灰兜底 */
  return hit ?? { from: '#5B8DEF', to: '#3F6FD0' }
}
