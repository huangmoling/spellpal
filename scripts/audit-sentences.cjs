/**
 * 全量例句体检：规则扫描
 * 输出到 stdout，按类别分组
 */
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '..', 'src', 'data', 'books')
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))

const rows = []
for (const f of files) {
  const book = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  for (const s of book.sentences || []) {
    rows.push({ file: f, id: s.id, cn: (s.cn || '').trim(), en: (s.en || '').trim(), tokens: s.tokens || [] })
  }
}

console.log('总句数', rows.length, '| 文件数', files.length)

const buckets = {
  pleaseTail: [], // please 在句尾且无逗号
  lowerStart: [], // 首字母小写
  cnPunct: [], // 混入中文标点
  doubleSpace: [], // 多空格
  spaceBeforePunct: [], // 标点前有空格
  noSpaceAfterPunct: [], // 标点后无空格
  emptyEn: [], // 空英文
  noPunctEnd: [], // 结尾无标点
  dupWord: [], // 相邻重复词
  enCnUnbalanced: [], // 英文词数与中文严重不等
  tokenMismatch: [], // tokens 拼起来和 en 不一致
  cnPeriodMissing: [], // 中文结尾标点异常
  allCaps: [],
  pronounCase: [], // 句首 i 小写之类
  articleIssue: [],
}

const CN_PUNCT = /[，。！？；：“”‘’（）]/
const wordOf = (en) => en.replace(/[.,!?;:'"()]/g, ' ').split(/\s+/).filter(Boolean)

for (const r of rows) {
  const { en, cn } = r
  if (!en) {
    buckets.emptyEn.push(r)
    continue
  }

  // 1. please 位置
  const low = en.toLowerCase()
  if (/\bplease\b[.!?]*$/.test(low) && !/,\s*please/.test(low)) {
    buckets.pleaseTail.push(r)
  }

  // 2. 首字母
  if (/^[a-z]/.test(en)) buckets.lowerStart.push(r)

  // 3. 中文标点
  if (CN_PUNCT.test(en)) buckets.cnPunct.push(r)

  // 4. 多空格
  if (/\s{2,}/.test(en)) buckets.doubleSpace.push(r)

  // 5. 标点前空格
  if (/\s[.,!?;:]/.test(en)) buckets.spaceBeforePunct.push(r)

  // 6. 标点后无空格（逗号/分号后紧跟字母）
  if (/[,;:][A-Za-z]/.test(en)) buckets.noSpaceAfterPunct.push(r)

  // 7. 结尾标点
  if (!/[.!?]$/.test(en)) buckets.noPunctEnd.push(r)

  // 8. 相邻重复词
  const w = wordOf(low)
  for (let i = 1; i < w.length; i++) {
    if (w[i] === w[i - 1] && w[i].length > 1) {
      buckets.dupWord.push(r)
      break
    }
  }

  // 9. tokens 与 en 是否一致
  if (r.tokens.length) {
    const joined = r.tokens.map((t) => t.en).join(' ').replace(/\s+/g, ' ').trim()
    const norm = (x) => x.replace(/\s+/g, ' ').trim()
    if (norm(joined) !== norm(en)) buckets.tokenMismatch.push({ ...r, joined })
  }

  // 10. 全大写
  if (en.length > 4 && en === en.toUpperCase() && /[A-Z]{3,}/.test(en)) buckets.allCaps.push(r)

  // 11. 中文句号
  if (cn && !/[。！？…]$/.test(cn)) buckets.cnPeriodMissing.push(r)
}

const show = (name, list, fmt = (r) => `${r.file} ${r.id} | ${r.cn} => ${r.en}`) => {
  console.log(`\n===== ${name} (${list.length}) =====`)
  for (const r of list) console.log('  ' + fmt(r))
}

show('please 在句尾且无逗号', buckets.pleaseTail)
show('首字母小写', buckets.lowerStart)
show('混入中文标点', buckets.cnPunct)
show('多空格', buckets.doubleSpace)
show('标点前有空格', buckets.spaceBeforePunct)
show('标点后无空格', buckets.noSpaceAfterPunct)
show('结尾无标点', buckets.noPunctEnd)
show('相邻重复词', buckets.dupWord)
show('tokens 与 en 不一致', buckets.tokenMismatch, (r) => `${r.file} ${r.id}\n     en: ${r.en}\n  token: ${r.joined}`)
show('全大写', buckets.allCaps)
show('英文空', buckets.emptyEn)
show('中文缺结尾标点', buckets.cnPeriodMissing)
