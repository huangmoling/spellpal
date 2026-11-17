import type { Book } from '@/types'
import pep3a from './pep-3start-3a.json'
import pep3b from './pep-3start-3b.json'
import pep4a from './pep-4start-4a.json'

/** 已收录的教材。加新册只需生成 JSON 后在这里 import 一行。 */
export const BOOKS = [
  pep3a as unknown as Book,
  pep3b as unknown as Book,
  pep4a as unknown as Book,
]

export const DEFAULT_BOOK_ID = BOOKS[0].id

export function findBook(id: string | null | undefined): Book {
  return BOOKS.find((b) => b.id === id) ?? BOOKS[0]
}
