/**
 * 错题本 + 间隔重复（SRS）
 *
 * 设计取舍：
 * - 只用 localStorage，不引 Dexie。理由：单机、单用户、卡片数量最多几百条，
 *   JSON 序列化成本可忽略；少一个依赖少一处打包问题。
 * - 练习单位是「句」，所以错题本也按句子记：复习时整句重打，
 *   比单练某个词更接近真实语感。
 * - 只有「打错过 / 跳过」的句子才进册。一次打对的句子不进来，
 *   否则错题本会变成第二个课表，孩子翻不到重点。
 * - box 0–5 对应复习间隔 0/1/3/7/16/35 天。答错掉回 box 0，答对升一级。
 */

import type { Book, Sentence } from '@/types'

const KEY = 'spellpal:srs'

/** 各 box 对应的复习间隔（天）。box0 = 当天再来一次 */
const INTERVALS = [0, 1, 3, 7, 16, 35]
const MAX_BOX = INTERVALS.length - 1

export interface Card {
  /** bookId#sentenceId */
  id: string
  bookId: string
  itemId: string
  /** 英文整句 */
  en: string
  /** 中文整句 */
  cn: string
  unit: number
  box: number
  /** 累计答错次数 */
  wrong: number
  /** 累计答对次数 */
  right: number
  /** 下次到期时间戳 */
  due: number
  last: number
}

type CardMap = Record<string, Card>

function read(): CardMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CardMap) : {}
  } catch {
    return {}
  }
}

function write(m: CardMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    /* 配额满等场景静默 */
  }
}

const cardKey = (bookId: string, itemId: string) => `${bookId}#${itemId}`
const dayMs = 86400000

export function getCard(bookId: string, itemId: string): Card | undefined {
  return read()[cardKey(bookId, itemId)]
}

export function allCards(): Card[] {
  return Object.values(read())
}

/** 到期待复习的句子卡；传 bookId 只取该册 */
export function dueCards(bookId?: string, now = Date.now()): Card[] {
  return allCards()
    .filter((c) => c.due <= now && (!bookId || c.bookId === bookId))
    .sort((a, b) => a.due - b.due)
}

/** 该册待复习数量 */
export function dueCount(bookId?: string): number {
  return dueCards(bookId).length
}

/** 该册错题总数（含未到期） */
export function cardCount(bookId?: string): number {
  return allCards().filter((c) => !bookId || c.bookId === bookId).length
}

/**
 * 记录一次练习结果。
 * @param ok 是否一次打对（没错过、没跳过）
 */
export function recordResult(book: Book, sentence: Sentence, ok: boolean): Card | null {
  const m = read()
  const k = cardKey(book.id, sentence.id)
  const prev = m[k]
  const now = Date.now()

  // 从没打错过、这次也打对了 —— 不进册
  if (!prev && ok) return null

  const box = ok ? Math.min(MAX_BOX, (prev?.box ?? 0) + 1) : 0
  const card: Card = {
    id: k,
    bookId: book.id,
    itemId: sentence.id,
    en: sentence.en,
    cn: sentence.cn,
    unit: sentence.unit,
    box,
    wrong: (prev?.wrong ?? 0) + (ok ? 0 : 1),
    right: (prev?.right ?? 0) + (ok ? 1 : 0),
    due: now + INTERVALS[box] * dayMs,
    last: now,
  }
  m[k] = card
  write(m)
  return card
}

/** 标记已掌握：直接移出错题本 */
export function markMastered(bookId: string, itemId: string) {
  const m = read()
  const k = cardKey(bookId, itemId)
  if (m[k]) {
    delete m[k]
    write(m)
  }
}

/** 清空整册错题（设置里的「重置本书错题」） */
export function clearBook(bookId: string) {
  const m = read()
  let touched = false
  for (const k of Object.keys(m)) {
    if (m[k].bookId === bookId) {
      delete m[k]
      touched = true
    }
  }
  if (touched) write(m)
}

/** 人类可读的到期描述 */
export function dueLabel(card: Card, now = Date.now()): string {
  const diff = card.due - now
  if (diff <= 0) return '待复习'
  const days = Math.ceil(diff / dayMs)
  return days === 1 ? '明天' : `${days} 天后`
}
