import type { Book } from '@/types'
import starterPhonics from './starter-phonics.json'
import pep1a from './pep-1start-1a.json'
import pep1b from './pep-1start-1b.json'
import pep2a from './pep-2start-2a.json'
import pep2b from './pep-2start-2b.json'
import pep3a from './pep-3start-3a.json'
import pep3b from './pep-3start-3b.json'
import pep4a from './pep-4start-4a.json'
import pep4b from './pep-4start-4b.json'
import pep5a from './pep-5start-5a.json'
import pep5b from './pep-5start-5b.json'
import pep6a from './pep-6start-6a.json'
import fltrp3a from './fltrp-3a.json'
import fltrp3b from './fltrp-3b.json'
import fltrp4a from './fltrp-4a.json'
import fltrp4b from './fltrp-4b.json'
import fltrp5a from './fltrp-5a.json'
import fltrp5b from './fltrp-5b.json'
import fltrp6a from './fltrp-6a.json'
import yilin3a from './yilin-3a.json'
import yilin3b from './yilin-3b.json'
import jj3b from './jj-3b.json'
import cj3b from './cj-3b.json'
import qh3b from './qh-3b.json'
import hj3b from './hj-3b.json'
import xs3b from './xs-3b.json'
import ls3b from './ls-3b.json'

/**
 * 已收录的教材。加新册只需生成 JSON 后在这里 import 一行。
 * 顺序即书架显示顺序：先启蒙路径（L0 拼读 → L2/L3 主题词），再小学同步。
 */
export const BOOKS = [
  starterPhonics as unknown as Book,
  pep1a as unknown as Book,
  pep1b as unknown as Book,
  pep2a as unknown as Book,
  pep2b as unknown as Book,
  pep3a as unknown as Book,
  pep3b as unknown as Book,
  pep4a as unknown as Book,
  pep4b as unknown as Book,
  pep5a as unknown as Book,
  pep5b as unknown as Book,
  pep6a as unknown as Book,
  fltrp3a as unknown as Book,
  fltrp3b as unknown as Book,
  fltrp4a as unknown as Book,
  fltrp4b as unknown as Book,
  fltrp5a as unknown as Book,
  fltrp5b as unknown as Book,
  fltrp6a as unknown as Book,
  yilin3a as unknown as Book,
  yilin3b as unknown as Book,
  jj3b as unknown as Book,
  cj3b as unknown as Book,
  qh3b as unknown as Book,
  hj3b as unknown as Book,
  xs3b as unknown as Book,
  ls3b as unknown as Book,
]

/** 默认打开三年级上册（小学同步的起点） */
export const DEFAULT_BOOK_ID = (pep3a as unknown as Book).id

export function findBook(id: string | null | undefined): Book {
  return BOOKS.find((b) => b.id === id) ?? BOOKS[0]
}
