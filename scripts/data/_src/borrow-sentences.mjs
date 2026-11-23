#!/usr/bin/env node
/**
 * 新册例句借用器
 *
 * 2026 秋补齐的 16 册上册目前只有词表、没有配套例句。与其现造，不如从 86 册
 * 已经人工核过的例句里，按「句子里真的出现过这个词」借过来：
 *   - 句子全部是真句，且已经合成过音频（文本 hash 相同 → 音频直接复用）
 *   - 词性/中文标注原样带过来，不用再过一遍 annotate
 *
 * 输出：scripts/data/sentences-{bookId}.tsv（与手写例句同格式）
 * 借不到句子的词就空着——练习页会自动退化成「只练单词」，不会报错。
 *
 * v2：保留已借到的例句，只补缺；匹配支持屈折变形（run/runs/running）与多词
 * 短语；单元号写教材原编号（与词表 TSV 对齐，build 才不会二次错位）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.resolve(__dirname, '..')
const BOOKS_DIR = path.resolve(DATA, '..', '..', 'src', 'data', 'books')

const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['bj-3a', 'bj-4a', 'bj-5a', 'hj-3a', 'hj-4a', 'hj-5a', 'jk-3a', 'jk-4a', 'jk-5a', 'jk-6a',
     'xs-3a', 'xs-4a', 'xs-5a', 'xs-6a', 'yl-4a', 'yl-5a']


/** 词条里的斜杠=任选其一，括号=注释（dad（father）/photo（=photograph）/Mrs (AmE Mrs.)） */
function wordAlts(word) {
  const base = String(word)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return base.split('/').map((s) => s.trim()).filter(Boolean).length
    ? base.split('/').map((s) => s.trim()).filter(Boolean)
    : [String(word)]
}

function infl(w) {
  w = w.toLowerCase()
  const out = new Set([w])
  const IRR = {
    be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
    have: ['has', 'had', 'having'],
    do: ['does', 'did', 'done', 'doing'],
    go: ['goes', 'went', 'gone', 'going'],
    child: ['children'], man: ['men'], woman: ['women'],
    foot: ['feet'], tooth: ['teeth'], mouse: ['mice'], person: ['people'],
  }
  if (IRR[w]) IRR[w].forEach((x) => out.add(x))
  if (w.length < 2) return out
  if (/y$/.test(w)) { const b = w.slice(0, -1); out.add(b + 'ies'); out.add(b + 'ied'); out.add(b + 'ier'); out.add(b + 'iest') }
  if (/(s|x|z|ch|sh|o)$/.test(w)) out.add(w + 'es')
  out.add(w + 's'); out.add(w + 'ed'); out.add(w + 'd'); out.add(w + 'ing')
  if (/e$/.test(w)) { out.add(w.slice(0, -1) + 'ing'); out.add(w.slice(0, -1) + 'ed') }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) { out.add(w + w.slice(-1) + 'ed'); out.add(w + w.slice(-1) + 'ing') }
  return out
}

const wordForms = (t) =>
  String(t).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)

/** 句子里是否真的出现这个词（支持短语 + 屈折变形） */

/** 含省略号的词条（take ... into）：各段按顺序出现即可，允许中间隔词 */
function hasSegs(sentEn, word) {
  if (!/\.\.\.|…/.test(word)) return null
  const segs = String(word).split(/\.\.\.|…/).map((s) => s.trim()).filter(Boolean)
  const forms = wordForms(sentEn)
  let cur = 0
  for (const seg of segs) {
    const parts = wordForms(seg)
    if (!parts.length) continue
    let found = -1
    for (let i = cur; i + parts.length <= forms.length; i++) {
      let ok = true
      for (let k = 0; k < parts.length; k++) {
        const p0 = parts[k], f0 = forms[i + k]
        const okPos = p0 === "one's" ? /^(his|her|its|their|my|your|our|one's)$/.test(f0) : infl(p0).has(f0)
        if (!okPos) { ok = false; break }
      }
      if (ok) { found = i + parts.length; break }
    }
    if (found < 0) return false
    cur = found
  }
  return true
}

function has(sentEn, word) {
  const seg = hasSegs(sentEn, word)
  if (seg !== null) return seg
  return wordAlts(word).some((alt) => {
    const parts = wordForms(alt)
    const forms = wordForms(sentEn)
    if (!parts.length) return false
    for (let i = 0; i + parts.length <= forms.length; i++) {
      let ok = true
      for (let k = 0; k < parts.length; k++) {
        const p0 = parts[k], f0 = forms[i + k]
        const okPos = p0 === "one's"
          ? /^(his|her|its|their|my|your|our|one's)$/.test(f0)
          : infl(p0).has(f0)
        if (!okPos) { ok = false; break }
      }
      if (ok) return true
    }
    return false
  })
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z'-]/g, '')

/** 建全局池：小写词 → 句子记录（同一句只用一次） */
const pool = new Map()
const allSentences = []
for (const f of fs.readdirSync(BOOKS_DIR)) {
  if (!f.endsWith('.json')) continue
  const id = f.replace(/\.json$/, '')
  if (TARGETS.includes(id)) continue
  const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, f), 'utf8'))
  for (const s of book.sentences || []) {
    if (!s.tokens || !s.tokens.length) continue
    // 只借 3–7 个词块的中短句，小学生一次别打太长
    if (s.tokens.length < 2 || s.tokens.length > 8) continue
    if (/[，。！？、；：]/.test(s.en)) continue
    const rec = { en: s.en, cn: s.cn, tokens: s.tokens, from: id, used: false }
    allSentences.push(rec)
    const seen = new Set()
    for (const t of s.tokens) {
      const k = norm(t.en)
      if (!k || seen.has(k)) continue
      seen.add(k)
      if (!pool.has(k)) pool.set(k, [])
      pool.get(k).push(rec)
    }
  }
}

let totalBorrowed = 0
const REMAP = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'unit-remap.json'), 'utf8'),
)

for (const bookId of TARGETS) {
  const ID_ALIAS = { 'pep-6b': 'pep-6start-6b' }
  const jsonName = ID_ALIAS[bookId] || bookId
  const file = path.join(BOOKS_DIR, `${jsonName}.json`)
  if (!fs.existsSync(file)) {
    console.warn(`跳过 ${bookId}：还没有构建产物`)
    continue
  }
  const book = JSON.parse(fs.readFileSync(file, 'utf8'))
  const inv = REMAP[bookId] || {}
  const outFile = path.join(DATA, `sentences-${bookId}.tsv`)

  // ---- 保留已借到的例句 ----
  const baseRows = []
  const usedHere = new Set()
  if (fs.existsSync(outFile)) {
    for (const line of fs.readFileSync(outFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue
      baseRows.push(line)
      usedHere.add(line.split('\t')[2] || '')
    }
  }

  // ---- 算哪些词还没覆盖 ----
  const miss = []
  for (const unit of book.units) {
    const sents = book.sentences.filter((x) => x.unit === unit.no)
    for (const w of book.words.filter((x) => x.unit === unit.no)) {
      if (sents.some((x) => has(x.en, w.word))) continue
      if (baseRows.some((ln) => {
        const c = ln.split('\t')
        return Number(c[0]) === (inv[unit.no] ?? unit.no) && has(c[2], w.word)
      })) continue
      miss.push({ w, unitNo: unit.no })
    }
  }

  const rows = []
  let borrowed = 0
  for (const { w, unitNo } of miss) {
    // 先按词块精确找，找不到再全库扫（支持屈折变形 / 短语）
    let cands = (pool.get(norm(w.word)) || []).filter((c) => !usedHere.has(c.en))
    if (!cands.length) {
      cands = allSentences.filter((c) => !usedHere.has(c.en) && has(c.en, w.word))
    }
    if (!cands.length) cands = allSentences.filter((c) => has(c.en, w.word)) // 最后防线：允许跨单元重复
    const pick = cands.sort((a, b) => a.tokens.length - b.tokens.length)[0]
    if (!pick) continue
    usedHere.add(pick.en)
    rows.push(
      [inv[unitNo] ?? unitNo, pick.cn, pick.en, pick.tokens.map((t) => t.pos).join('|'),
       pick.tokens.map((t) => t.cn).join('|')].join('\t'),
    )
    borrowed += 1
  }

  const all = baseRows.concat(rows)
  fs.writeFileSync(outFile, all.join('\n') + '\n', 'utf8')
  totalBorrowed += borrowed
  const words = book.words.length
  console.log(
    `✓ ${bookId}  补借 ${borrowed} 句，共 ${all.length}/${words} 句`,
  )
}
console.log(`本轮补借 ${totalBorrowed} 句`)
