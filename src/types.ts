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
  /** 单元要点（中文，界面主显示） */
  theme: string
  /** 单元要点英文副标题，显示在中文下方 */
  themeEn?: string
  wordIds: string[]
}

/** 句子里一个词块：英文 + 中文 + 词性 */
export interface SentenceToken {
  en: string
  cn: string
  pos: string
}

/** 一句同步例句。练习以「句」为单位，逐词跟打。 */
export interface Sentence {
  id: string
  unit: number
  /** 中文整句，练习时显示在正上方 */
  cn: string
  /** 英文整句 */
  en: string
  /** 与 en 按空格切分一一对应 */
  tokens: SentenceToken[]
  /**
   * 练习单位类型。
   * - `sentence`（默认）：整句逐词跟打
   * - `word`：单元里的单个单词，先于句子练；只有一块，标题就是中文释义
   */
  kind?: 'word' | 'sentence'
  /** 单词模式下显示的音标 */
  ipa?: string
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
  /** starter = 1–2 年级启蒙路径；primary = 小学同步教材 */
  stage?: 'starter' | 'primary'
  wordCount: number
  sentenceCount?: number
  updatedAt: string
  units: Unit[]
  words: Word[]
  /** 同步例句。老词库可能没有这一层，读取时按空数组处理。 */
  sentences?: Sentence[]
}

/** 单个字符槽的状态 */
export type SlotState = 'pending' | 'cursor' | 'correct' | 'wrong' | 'fixed'
