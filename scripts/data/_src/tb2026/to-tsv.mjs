#!/usr/bin/env node
/**
 * 2026 秋新教材词表 → scripts/data/{bookId}.tsv
 *
 * 输入：scripts/data/_src/tb2026/{key}.words.json（build_tb.py 的产物，带 unit 归属）
 * 输出：unit|word|ipaUK|cnShort|cnFull|syllables
 *
 * 音节切分是启发式的（VCCV 断开、保留词尾不发音 e、常见辅音连缀不拆），
 * 只要求「拼回去等于原词」，给孩子看的速记分块够用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = __dirname
const OUT = path.resolve(__dirname, '..', '..') // scripts/data

/** tb2026 的键 → 应用里的 bookId */
const MAP = {
  'bj-三a': 'bj-3a',
  'bj-四a': 'bj-4a',
  'bj-五a': 'bj-5a',
  'hj-三a': 'hj-3a',
  'hj-四a': 'hj-4a',
  'hj-五a': 'hj-5a',
  'jk-三a': 'jk-3a',
  'jk-四a': 'jk-4a',
  'jk-五a': 'jk-5a',
  'jk-六a': 'jk-6a',
  'xs-三a': 'xs-3a',
  'xs-四a': 'xs-4a',
  'xs-五a': 'xs-5a',
  'xs-六a': 'xs-6a',
  'yl-四a': 'yl-4a',
  'yl-五a': 'yl-5a',
}

const VOWELS = 'aeiouy'
const isV = (c) => VOWELS.includes(c)

/** 不拆的辅音连缀（放一起更好读） */
const CLUSTERS = [
  'ch', 'sh', 'th', 'ph', 'wh', 'gh', 'ck', 'ng', 'qu',
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl',
  'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'str', 'spr', 'spl', 'squ', 'scr',
]

/** 把一个单词（可含空格/连字符）切成速记分块 */
function syllabify(raw) {
  return String(raw)
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part.trim() || part === '-' || /^\s+$/.test(part)) return part
      return chunkWord(part)
    })
    .join('')
}

function chunkWord(w) {
  const s = w.toLowerCase()
  if (s.length <= 3) return w
  /** 找出每个元音组的起止 */
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
    // 词尾不发音的 e（bike / name / hope）：并进前一节
    const lastGroup = g === groups.length - 1
    const silentE =
      lastGroup && start === s.length - 1 && s[start] === 'e' && cluster.length === 1
    if (silentE) continue
    if (!cluster.length) continue
    // 两辅音以上：从中间偏后断开（lis|ten、win|ter）
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
  return out.filter(Boolean).join('-')
}

/** 释义取第一个义项，控制在 12 字内（界面词块就那么宽） */
function shortGloss(gloss) {
  const s = String(gloss || '').replace(/\s+/g, ' ').trim()
  const first = s.split(/[，、；;]/)[0].trim()
  const pick = first || s
  return pick.length > 12 ? pick.slice(0, 12) : pick
}

function run() {
  const only = process.argv.slice(2)
  let n = 0
  for (const [key, bookId] of Object.entries(MAP)) {
    if (only.length && !only.includes(bookId)) continue
    const file = path.join(SRC, `${key}.words.json`)
    if (!fs.existsSync(file)) {
      console.warn(`跳过 ${key}：没有 ${path.basename(file)}`)
      continue
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const words = (data.words || []).filter((x) => x && x.word && x.gloss)
    if (!words.length) {
      console.warn(`跳过 ${key}：words 为空`)
      continue
    }
    // 单元内按课次排；没有 lesson 的保持原顺序
    const rows = words
      .map((x, i) => ({ ...x, _i: i }))
      .sort((a, b) => (a.unit || 0) - (b.unit || 0) || (a.lesson || 0) - (b.lesson || 0) || a._i - b._i)

    const lines = rows.map((x) => {
      const cn = shortGloss(x.gloss)
      const ipa = String(x.ipaUK || '').trim() || '/-/'
      const syl = syllabify(x.word.trim())
      return [x.unit || 1, x.word.trim(), ipa, cn, cn, syl].join('|')
    })
    const outFile = path.join(OUT, `${bookId}.tsv`)
    fs.writeFileSync(outFile, lines.join('\r\n') + '\r\n', 'utf8')
    const units = new Set(rows.map((x) => x.unit || 1))
    console.log(`✓ ${bookId}  ${rows.length} 词 / ${units.size} 单元  ->  scripts/data/${bookId}.tsv`)
    n += 1
  }
  console.log(`共生成 ${n} 册`)
}

run()
