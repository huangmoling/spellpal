import { useEffect, useState } from 'react'
import { useApp } from '@/store/useApp'
import BookShelf from '@/pages/BookShelf'
import Practice from '@/pages/Practice'
import Result from '@/pages/Result'
import WindowControls from '@/components/WindowControls'
import SettingsSheet from '@/components/SettingsSheet'
import { BOOKS, DEFAULT_BOOK_ID } from '@/data/books'

const BOOK_KEY = 'spellpal:book'

/* 开发期调试接口：自动化截图脚本用它直接指定教材与单元 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__spellpalBooks = BOOKS
}

export default function App() {
  const phase = useApp((s) => s.phase)
  const settingsOpen = useApp((s) => s.settingsOpen)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
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
      {phase === 'idle' && (
        <BookShelf
          books={BOOKS}
          bookId={bookId}
          onPickBook={setBookId}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {phase === 'typing' && <Practice onOpenSettings={() => setSettingsOpen(true)} />}
      {phase === 'done' && <Result />}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}

      {/* 放最后渲染：拖拽区按 DOM 顺序登记，晚上一步的 no-drag 才压得住顶栏 */}
      <WindowControls />
    </div>
  )
}
