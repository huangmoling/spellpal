/** 三册补缺：xlsx 导出的单词 JSON → scripts/data/{bookId}.tsv（6 列） */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const DATA = path.join(ROOT, 'scripts', 'data')

const VOWELS = 'aeiouy'
const isV = (c) => VOWELS.includes(c)
const CLUSTERS = ['ch', 'sh', 'th', 'ph', 'wh', 'ck', 'ng', 'gh', 'tr', 'dr', 'br', 'cr', 'fr', 'gr', 'pr', 'bl', 'cl', 'fl', 'gl', 'pl', 'st', 'sp', 'sk', 'sm', 'sn', 'sw', 'tw']

function chunkWord(w) {
  const s = w.toLowerCase()
  if (s.length <= 3) return w
  const groups = []
  for (let i = 0; i < s.length; i += 1) {
    if (!isV(s[i])) continue
    let j = i
    while (j + 1 < s.length && isV(s[j + 1])) j += 1
    groups.push([i, j])
    i = j
  }
  if (groups.length < 2) return w
  const cuts = new Set()
  for (let g = 1; g < groups.length; g += 1) {
    const start = groups[g][0]
    const prevEnd = groups[g - 1][1]
    const cluster = s.slice(prevEnd + 1, start)
    const lastGroup = g === groups.length - 1
    const silentE = lastGroup && start === s.length - 1 && s[start] === 'e' && cluster.length === 1
    if (silentE) continue
    if (!cluster.length) continue
    let cut
    if (cluster.length >= 2) {
      cut = prevEnd + 1 + (CLUSTERS.includes(cluster.slice(-2)) ? cluster.length - 2 : cluster.length - 1)
    } else {
      cut = prevEnd + 1
    }
    if (cut > 0 && cut < s.length) cuts.add(cut)
  }
  if (!cuts.size) return w
  const out = []
  let prev = 0
  for (const c of [...cuts].sort((a, b) => a - b)) {
    if (c - prev < 2) continue
    out.push(w.slice(prev, c))
    prev = c
  }
  out.push(w.slice(prev))
  return out.join('-')
}

function syllabify(raw) {
  return String(raw)
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part.trim() || part === '-' || /^\s+$/.test(part)) return part
      return chunkWord(part)
    })
    .join('')
}

const POS_RE = /^(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|na|vbl|aux|abbr|pl)\.\s*/i
const PAREN = /[（([][^）)]]*[）)]]/g

function cleanGloss(raw) {
  if (!raw) return { short: '', full: '' }
  const t = String(raw).replace(/\r/g, '').replace(PAREN, '').replace(/\s+/g, ' ').trim()
  const segs = t.split(/[\n；;]/).map((s) => s.replace(POS_RE, '').replace(/^[,\s]+|[,\s]+$/g, '')).filter(Boolean)
  const full = segs.join('；')
  let short = segs[0] || ''
  if (short.length > 12) short = short.slice(0, 12)
  return { short, full }
}

const FIX = Object.assign({
  "bark": "狗叫",
  "active": "活跃的",
  "felt": "感觉",
  "spoke": "说",
  "lower": "更低的",
  "thinner": "更瘦的",
  "heavier": "更重的",
  "younger": "更年轻的",
  "shorter": "更矮的",
  "smarter": "更聪明的",
  "smaller": "更小的",
  "licked": "舔",
  "laughed": "笑",
  "video": "视频",
  "cheetah": "猎豹",
  "geography": "地理",
  "chemistry": "化学",
  "physics": "物理",
  "happiness": "幸福",
  "tangyuan": "汤圆",
  "Bund": "外滩",
  "till": "直到",
  "mule": "骡子",
  "went camping": "去露营",
  "cent": "美分",
  "shopp ing centre": "购物中心",
  "messy": "凌乱的",
  "coal": "煤",
  "skin": "果皮",
  "slip": "滑倒",
  "shadow": "影子",
  "dining hall": "食堂",
  "cycling": "骑自行车",
}, {
  'went camping': '去露营',
  'went fishing': '去钓鱼',
  'took pictures': '拍照',
  'had a cold': '感冒',
  'make a sentence': '造句',
  'do shopping': '购物',
  'What does it mean?': '这是什么意思',
  'No eating or drinking.': '禁止饮食',
  'No littering.': '禁止乱扔垃圾',
  'No parking.': '禁止停车',
  'No smoking.': '禁止吸烟',
  'Wet floor.': '小心地滑',
  'Danger!': '危险',
  'What happened?': '发生什么了',
  'What day is today?': '今天星期几',
  'to go': '带走',
  'TV': '电视',
  'look up': '查阅',
  'go cycling': '去骑自行车',
  'make friends': '交朋友',
  'all over the world': '全世界',
  'look out of': '向外看',
  'go on': '继续',
  'take ... into': '带入',
  'move ... away from': '从……移开',
  'pick ... up': '捡起',
  'cut down': '砍伐',
  'too many': '太多',
  'too much': '太多',
  'come from': '来自',
  'turn into': '变成',
  'climb up': '爬上',
  'hold onto': '抓紧',
  'fly away': '飞走',
  'go well': '进展顺利',
  'at first': '起初',
  'then and now': '过去与现在',
  'long long ago': '很久以前',
  'make mistakes': '犯错',
  'best wishes': '最美好的祝福',
  'primary school': '小学',
  'middle school': '初中',
  'keep on': '继续',
  'each other': '互相',
  'at the same time': '同时',
  'look like': '看起来像',
  'Be careful!': '小心',
  'role model': '榜样',
  'all over': '到处',
  'red packet': '红包',
  'lion dance': '舞狮',
  "Chinese New Year's Eve": '除夕',
  "Chinese New Year's Day": '大年初一',
  'next week': '下周',
  'next month': '下个月',
})

const UNITS = {
  'pep-6b': [[1, 22], [23, 46], [47, 70], [71, 92]],
  'yl-6a': [[1, 19], [20, 43], [44, 61], [62, 80], [81, 104], [105, 120], [121, 149], [150, 165]],
  'fltrp-6b': [[1, 10], [11, 28], [29, 36], [37, 50], [51, 70], [71, 88], [89, 100], [101, 112]],
}

const src = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp', 'new3-words.json'), 'utf8'))
for (const [bookId, rows] of Object.entries(src)) {
  const spans = UNITS[bookId]
  if (!spans) throw new Error('no units for ' + bookId)
  const unitOf = (i) => {
    const n = i + 1
    const idx = spans.findIndex(([a, b]) => n >= a && n <= b)
    if (idx < 0) throw new Error(bookId + ' word ' + n + ' out of span')
    return idx + 1
  }
  const lines = []
  const seen = new Set()
  rows.forEach((r, i) => {
    const w = r.w.trim()
    const key = w.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const fix = FIX[w]
    const { short, full } = cleanGloss(r.g)
    const cnShort = fix || short
    const cnFull = fix ? fix : (full || short)
    if (!cnShort) throw new Error(bookId + ' ' + w + ' no gloss')
    const ipa = (r.ipa || '').replace(/^\[|\]$/g, '').trim()
    lines.push([unitOf(i), w, ipa || '/', cnShort, cnFull, syllabify(w)].join('|'))
  })
  const out = path.join(DATA, bookId + '.tsv')
  fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8')
  console.log(bookId + '  ' + lines.length + ' 词  ' + spans.length + ' 单元')
  const noIpa = rows.filter((r) => !(r.ipa || '').trim()).map((r) => r.w)
  if (noIpa.length) console.log('   缺音标 ' + noIpa.length + ': ' + noIpa.join(', '))
}
