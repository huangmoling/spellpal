import { useEffect, useState } from 'react'
import { useApp } from '@/store/useApp'
import BookShelf from '@/pages/BookShelf'
import Practice from '@/pages/Practice'
import Result from '@/pages/Result'
import WindowControls from '@/components/WindowControls'
import { BOOKS, DEFAULT_BOOK_ID } from '@/data/books'

const BOOK_KEY = 'spellpal:book'

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
