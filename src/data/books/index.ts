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
import bj2a from './bj-2a.json'
import bj2b from './bj-2b.json'
import bj3b from './bj-3b.json'
import bj4b from './bj-4b.json'
import bj5b from './bj-5b.json'
import bj6a from './bj-6a.json'
import bj6b from './bj-6b.json'
import bsd3a from './bsd-3a.json'
import bsd3b from './bsd-3b.json'
import bsd4a from './bsd-4a.json'
import bsd4b from './bsd-4b.json'
import bsd5b from './bsd-5b.json'
import bsd6b from './bsd-6b.json'
import cj3a from './cj-3a.json'
import cj4a from './cj-4a.json'
import cj4b from './cj-4b.json'
import cj5a from './cj-5a.json'
import cj5b from './cj-5b.json'
import cj6a from './cj-6a.json'
import cj6b from './cj-6b.json'
import hj4b from './hj-4b.json'
import hj5b from './hj-5b.json'
import hj6a from './hj-6a.json'
import hj6b from './hj-6b.json'
import jj3a from './jj-3a.json'
import jj4a from './jj-4a.json'
import jj4b from './jj-4b.json'
import jj5a from './jj-5a.json'
import jj5b from './jj-5b.json'
import jj6a from './jj-6a.json'
import jj6b from './jj-6b.json'
import jk3b from './jk-3b.json'
import jk4b from './jk-4b.json'
import jk5b from './jk-5b.json'
import jk6b from './jk-6b.json'
import ls3a from './ls-3a.json'
import ls4a from './ls-4a.json'
import ls4b from './ls-4b.json'
import ls5a from './ls-5a.json'
import ls5b from './ls-5b.json'
import ls6a from './ls-6a.json'
import ls6b from './ls-6b.json'
import qh2a from './qh-2a.json'
import qh2b from './qh-2b.json'
import qh3a from './qh-3a.json'
import qh4a from './qh-4a.json'
import qh4b from './qh-4b.json'
import qh5a from './qh-5a.json'
import qh5b from './qh-5b.json'
import qh6a from './qh-6a.json'
import qh6b from './qh-6b.json'
import xs4b from './xs-4b.json'
import xs5b from './xs-5b.json'
import xs6b from './xs-6b.json'
import yl3b from './yl-3b.json'
import yl4b from './yl-4b.json'
import yl5b from './yl-5b.json'
import yl6b from './yl-6b.json'

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
  bj2a as unknown as Book,
  bj2b as unknown as Book,
  bj3b as unknown as Book,
  bj4b as unknown as Book,
  bj5b as unknown as Book,
  bj6a as unknown as Book,
  bj6b as unknown as Book,
  bsd3a as unknown as Book,
  bsd3b as unknown as Book,
  bsd4a as unknown as Book,
  bsd4b as unknown as Book,
  bsd5b as unknown as Book,
  bsd6b as unknown as Book,
  cj3a as unknown as Book,
  cj4a as unknown as Book,
  cj4b as unknown as Book,
  cj5a as unknown as Book,
  cj5b as unknown as Book,
  cj6a as unknown as Book,
  cj6b as unknown as Book,
  hj4b as unknown as Book,
  hj5b as unknown as Book,
  hj6a as unknown as Book,
  hj6b as unknown as Book,
  jj3a as unknown as Book,
  jj4a as unknown as Book,
  jj4b as unknown as Book,
  jj5a as unknown as Book,
  jj5b as unknown as Book,
  jj6a as unknown as Book,
  jj6b as unknown as Book,
  jk3b as unknown as Book,
  jk4b as unknown as Book,
  jk5b as unknown as Book,
  jk6b as unknown as Book,
  ls3a as unknown as Book,
  ls4a as unknown as Book,
  ls4b as unknown as Book,
  ls5a as unknown as Book,
  ls5b as unknown as Book,
  ls6a as unknown as Book,
  ls6b as unknown as Book,
  qh2a as unknown as Book,
  qh2b as unknown as Book,
  qh3a as unknown as Book,
  qh4a as unknown as Book,
  qh4b as unknown as Book,
  qh5a as unknown as Book,
  qh5b as unknown as Book,
  qh6a as unknown as Book,
  qh6b as unknown as Book,
  xs4b as unknown as Book,
  xs5b as unknown as Book,
  xs6b as unknown as Book,
  yl3b as unknown as Book,
  yl4b as unknown as Book,
  yl5b as unknown as Book,
  yl6b as unknown as Book,
]

/** 默认打开三年级上册（小学同步的起点） */
export const DEFAULT_BOOK_ID = (pep3a as unknown as Book).id

export function findBook(id: string | null | undefined): Book {
  return BOOKS.find((b) => b.id === id) ?? BOOKS[0]
}
