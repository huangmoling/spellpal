export interface Sense {
  /** 小学化短义，界面主显示 */
  cn: string
  /** 完整释义，备用（点击展开） */
  cnFull?: string
  /** 分节练习用，如 ["可以","喝"] */
  split?: string[]
}

export interface Word {
  id: string
  word: string
  phoneticUK: string
  /** 音节切分，速记用，如 ["lis","ten"] */
  syllables: string[]
  senses: Sense[]
  grade: number
  unit: number
}

export interface Unit {
  no: number
  title: string
  theme: string
  wordIds: string[]
}

export interface Book {
  id: string
  title: string
  shortTitle: string
  publisher: string
  series: string
  grade: number
  term: 'up' | 'down'
  edition: string
  wordCount: number
  updatedAt: string
  units: Unit[]
  words: Word[]
}

/** 单个字符槽的状态 */
export type SlotState = 'pending' | 'cursor' | 'correct' | 'wrong' | 'fixed'
