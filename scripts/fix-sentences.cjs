/**
 * 例句修订（v0.12.0）
 * 用法：node scripts/fix-sentences.cjs [--apply]
 * 不带 --apply 只打印对比
 */
const fs = require('node:fs')
const path = require('node:path')

const APPLY = process.argv.includes('--apply')
const DIR = path.join(__dirname, '..', 'src', 'data', 'books')

/** id -> { en, tokens: [en, cn, pos][] } */
const FIX = {
  /* 中文「请 X」统一成 please 前置，与教材/翻译工具一致，也免得句尾 please 被当成没逗号 */
  'fltrp-3a-u1-s02': {
    en: 'Please open your book.',
    tokens: [
      ['Please', '请', '副词'],
      ['open', '打开', '动词'],
      ['your', '你的', '代词'],
      ['book.', '书', '名词'],
    ],
  },
  'starter-phonics-u3-s03': {
    en: 'Please sit down.',
    tokens: [
      ['Please', '请', '副词'],
      ['sit', '坐', '动词'],
      ['down.', '下', '副词'],
    ],
  },

  /* near 单独作表语不自然 */
  'pep-2start-2a-u4-s04': {
    en: 'The school is near here.',
    tokens: [
      ['The', '那所', '冠词'],
      ['school', '学校', '名词'],
      ['is', '是', '动词'],
      ['near', '近', '形容词'],
      ['here.', '这里', '副词'],
    ],
  },

  /* 中文是存在句「有」，英文也该用 There be */
  'pep-4start-4b-u1-s05': {
    en: 'There is a blackboard on the wall.',
    tokens: [
      ['There', '（有）', '代词'],
      ['is', '有', '动词'],
      ['a', '一块', '冠词'],
      ['blackboard', '黑板', '名词'],
      ['on', '（上面）', '介词'],
      ['the', '那面', '冠词'],
      ['wall.', '墙', '名词'],
    ],
  },

  /* rest early 不是地道说法 */
  'pep-5start-5a-u4-s06': {
    en: 'Put down the phone and go to bed early.',
    tokens: [
      ['Put', '放', '动词'],
      ['down', '下', '副词'],
      ['the', '那个', '冠词'],
      ['phone', '手机', '名词'],
      ['and', '和', '连词'],
      ['go', '去', '动词'],
      ['to', '（到）', '介词'],
      ['bed', '床', '名词'],
      ['early.', '早', '副词'],
    ],
  },

  /* 中文是「一位志愿者」，冠词该用 a；direct 是本单元词，必须留在句里 */
  'pep-5start-5b-u2-s06': {
    en: 'A volunteer can direct us.',
    tokens: [
      ['A', '一位', '冠词'],
      ['volunteer', '志愿者', '名词'],
      ['can', '能', '助动词'],
      ['direct', '指路', '动词'],
      ['us.', '给我们', '代词'],
    ],
  },

  /* northeast 作地区名要大写；tour 是本单元词，保留 */
  'pep-5start-5b-u6-s03': {
    en: 'We plan a tour to the Northeast.',
    tokens: [
      ['We', '我们', '代词'],
      ['plan', '计划', '动词'],
      ['a', '一次', '冠词'],
      ['tour', '旅行', '名词'],
      ['to', '去', '介词'],
      ['the', '那个', '冠词'],
      ['Northeast.', '东北', '名词'],
    ],
  },
}

const touched = new Set()
let applied = 0

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const p = path.join(DIR, f)
  const raw = fs.readFileSync(p, 'utf8')
  const book = JSON.parse(raw)
  let dirty = false

  for (const s of book.sentences || []) {
    const fix = FIX[s.id]
    if (!fix) continue
    if (touched.has(s.id)) {
      console.log(`!! 重复 id: ${s.id}`)
      continue
    }
    touched.add(s.id)
    console.log(`\n[${s.id}] ${f}`)
    console.log(`  中文 : ${s.cn}`)
    console.log(`  旧   : ${s.en}`)
    console.log(`  新   : ${fix.en}`)
    console.log(`  旧tkn: ${s.tokens.map((t) => t.en).join(' ')}`)
    console.log(`  新tkn: ${fix.tokens.map((t) => t[0]).join(' ')}`)

    s.en = fix.en
    s.tokens = fix.tokens.map(([en, cn, pos]) => ({ en, cn, pos }))
    dirty = true
    applied += 1
  }

  if (dirty && APPLY) fs.writeFileSync(p, JSON.stringify(book, null, 2))
}

const missing = Object.keys(FIX).filter((id) => !touched.has(id))
console.log(`\n应用 ${applied} / ${Object.keys(FIX).length}${APPLY ? '' : '（预演，未落盘）'}`)
if (missing.length) console.log('未找到：', missing.join(', '))
