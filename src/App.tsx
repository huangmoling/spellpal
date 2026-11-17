import { useEffect, useState } from 'react'
import { useApp } from '@/store/useApp'
import BookShelf from '@/pages/BookShelf'
import Practice from '@/pages/Practice'
import Result from '@/pages/Result'
import WindowControls from '@/components/WindowControls'
import { BOOKS, DEFAULT_BOOK_ID } from '@/data/books'

const BOOK_KEY = 'spellpal:book'

/* 开发期调试接口：自动化截图脚本用它直接指定教材与单元 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__spellpalBooks = BOOKS
}

export default function App() {
  const phase = useApp((s) => s.phase)
  const [bookId, setBookId] = useState<string>(() => {
    try {
      return localStorage.getItem(BOOK_KEY) || DEFAULT_BOOK_ID
    } catch {
      return DEFAULT_BOOK_ID
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(BOOK_KEY, bookId)
    } catch {
      /* ignore */
    }
  }, [bookId])

  return (
    <div className="relative h-full">
      <WindowControls />
      {phase === 'idle' && (
        <BookShelf books={BOOKS} bookId={bookId} onPickBook={setBookId} />
      )}
      {phase === 'typing' && <Practice />}
      {phase === 'done' && <Result />}
    </div>
  )
}
