#!/usr/bin/env node
/**
 * 音标联网复核：拿 Free Dictionary API 的发音当作第三方从源，
 * 和词库里的 phoneticUK 并排打出来，供人工看有没有明显错的。
 *   node scripts/data/_src/verify_ipa.mjs yilin-3a
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const book = process.argv[2] || 'yilin-3a'
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/books', `${book}.json`), 'utf8'))

const seen = new Set()
const targets = data.words.filter((w) => {
  const k = w.word.toLowerCase().replace(/[.,!?]/g, '')
  if (seen.has(k)) return false
  seen.add(k)
  return !k.includes(' ') // 短语查不到，单独人工核
})

const strip = (s) =>
  (s || '')
    .replace(/[\/\[\]ɡ]/g, 'g')
    .replace(/[ˈˌ.]/g, '')
    .replace(/\(r\)|r(?=\s|$)/g, '')
    .replace(/ː/g, ':')
    .toLowerCase()
    .trim()

const rows = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const w of targets) {
  const q = w.word.toLowerCase().replace(/[.,!?]/g, '')
  let api = ''
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const j = await res.json()
      const list = j?.[0]?.phonetics || []
      api = list.map((p) => p.text).filter(Boolean)[0] || j?.[0]?.phonetic || ''
    }
  } catch {
    api = ''
  }
  rows.push({ word: w.word, ours: w.phoneticUK, api, ok: !api || strip(api) === strip(w.phoneticUK) })
  await sleep(120)
}

const bad = rows.filter((r) => r.api && !r.ok)
console.log(`核对 ${rows.length} 个单词，有差异 ${bad.length} 个\n`)
for (const r of bad) console.log(`  ${r.word.padEnd(18)} 本地 ${r.ours.padEnd(18)} API ${r.api}`)
const noApi = rows.filter((r) => !r.api)
if (noApi.length) console.log(`\nAPI 无数据（需人工核）：${noApi.map((r) => r.word).join(', ')}`)
