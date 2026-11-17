import type { Book } from '@/types'
import starterPhonics from './starter-phonics.json'
import pep1a from './pep-1start-1a.json'
import pep1b from './pep-1start-1b.json'
import pep2a from './pep-2start-2a.json'
import pep3a from './pep-3start-3a.json'
import pep3b from './pep-3start-3b.json'
import pep4a from './pep-4start-4a.json'
import pep4b from './pep-4start-4b.json'
import pep5a from './pep-5start-5a.json'
import pep6a from './pep-6start-6a.json'

/**
 * 已收录的教材。加新册只需生成 JSON 后在这里 import 一行。
 * 顺序即书架显示顺序：先启蒙路径（L0 拼读 → L2/L3 主题词），再小学同步。
 */
export const BOOKS = [
  starterPhonics as unknown as Book,
  pep1a as unknown as Book,
  pep1b as unknown as Book,
  pep2a as unknown as Book,
  pep3a as unknown as Book,
  pep3b as unknown as Book,
  pep4a as unknown as Book,
  pep4b as unknown as Book,
  pep5a as unknown as Book,
  pep6a as unknown as Book,
]

/** 默认打开三年级上册（小学同步的起点） */
export const DEFAULT_BOOK_ID = (pep3a as unknown as Book).id

export function findBook(id: string | null | undefined): Book {
  return BOOKS.find((b) => b.id === id) ?? BOOKS[0]
}
