/**
 * 第二轮专项扫描：语法细节
 */
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '..', 'src', 'data', 'books')
const rows = []
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const b = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  for (const s of b.sentences || []) rows.push({ file: f, id: s.id, cn: (s.cn || '').trim(), en: (s.en || '').trim() })
}

const hit = (name, fn) => {
  const list = rows.filter(fn)
  console.log(`\n===== ${name} (${list.length}) =====`)
  for (const r of list) console.log(`  ${r.id} | ${r.cn} => ${r.en}`)
}

// 中文「请…」但英文 please 不在句首
hit('中文以「请」开头但 please 不在句首', (r) => /^请/.test(r.cn) && /please/i.test(r.en) && !/^please/i.test(r.en))

// 中文「请…」但英文完全没有 please
hit('中文以「请」开头但英文没有 please', (r) => /^请/.test(r.cn) && !/please/i.test(r.en))

// 英文 please 在句首但中文不是「请」开头
hit('英文 please 在句首但中文不是「请」开头', (r) => /^please/i.test(r.en) && !/^请/.test(r.cn))

// a 后接元音开头（应 an）
hit('a + 元音开头', (r) => /\ba\s+[aeiouAEIOU]/.test(r.en))

// an 后接辅音开头
hit('an + 辅音开头', (r) => /\ban\s+[bcdfgjklmnpqrstvwxyzBCDFGJKLMNPQRSTVWXYZ]/.test(r.en))

// 专有名词小写（国家/语言/星期/月份/节日）
const PROPER = /\b(china|english|chinese|america|american|canada|britain|australia|japan|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|christmas|spring festival|mid-autumn)\b/
hit('专有名词疑似小写', (r) => PROPER.test(r.en))

// 中文有「们」英文却是单数 be 动词
hit('中文「我们」+ 英文 is/am', (r) => /我们/.test(r.cn) && /\b(is|am)\b/.test(r.en))
hit('中文「他们/她们」+ 英文 is', (r) => /(他们|她们)/.test(r.cn) && /\bis\b/.test(r.en))

// 中文「了」但英文是现在时第三人称单数/原形（可能时态不符）
hit('中文「了」+ 英文 has/is/does', (r) => /了/.test(r.cn) && /\b(has|is|does|goes)\b/.test(r.en))

// 中文「很」+ 英文无 very/so/really（可接受，仅参考）
hit('中文「很」但英文无程度词', (r) => /很/.test(r.cn) && !/\b(very|so|really|quite|too)\b/.test(r.en))

// 中文「都」但英文无 both/all
hit('中文「都」但英文无 both/all', (r) => /都/.test(r.cn) && !/\b(both|all)\b/.test(r.en))

// 中文「也」但英文无 too/either/also
hit('中文「也」但英文无 too/either/also', (r) => /也/.test(r.cn) && !/\b(too|either|also)\b/.test(r.en))

// 中文「一起」但英文无 together
hit('中文「一起」但英文无 together', (r) => /一起/.test(r.cn) && !/\btogether\b/.test(r.en))

// 中文有数字，英文无对应数词（粗筛）
const CN_NUM = { 一: 'one', 二: 'two', 两: 'two', 三: 'three', 四: 'four', 五: 'five', 六: 'six', 七: 'seven', 八: 'eight', 九: 'nine', 十: 'ten' }
hit('中文数字无对应英文数词', (r) => {
  const m = r.cn.match(/[一二两三四五六七八九十]/)
  if (!m) return false
  if (/^[一二三四五六七八九十]、/.test(r.cn)) return false // 数字列举
  const w = CN_NUM[m[0]]
  return w && !new RegExp(`\\b${w}\\b`, 'i').test(r.en) && !/[0-9]/.test(r.en)
})

// 英文里连续两个限定词
hit('限定词连用', (r) => /\b(the|a|an|my|your|his|her|its|our|their)\s+(the|a|an|my|your|his|her|its|our|their)\b/i.test(r.en))

// 中文「的」但英文无所有格/形容词（粗筛，容易误报，仅看极短句）
hit('中文含「的」英文无撇号/形容词', (r) => /的/.test(r.cn) && !/'/.test(r.en) && r.en.split(/\s+/).length <= 3)
