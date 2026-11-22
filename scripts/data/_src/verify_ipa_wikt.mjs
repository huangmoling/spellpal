#!/usr/bin/env node
/**
 * 音标 + 拼写联网复核（英式口径）
 *
 * 拿 Wiktionary 词条里的 RP/UK 音标当第三方从源，跟词库里的 phoneticUK 并排比。
 * 为什么不继续用 api.dictionaryapi.dev：那个是美式记法，ɹ/ɛ/ɔː 与英式 r/e/ɒ 全线不同，
 * 三上那轮 108 个词报了 21 处「差异」全是误报，没有参考价值。
 *
 * 单条 action=parse 会被限流（137 条只回了 18 条），所以走 action=query 批量取，
 * 一次最多 50 个词条。
 *
 * 用法：node scripts/data/_src/verify_ipa_wikt.mjs yilin-3b
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const book = process.argv[2] || 'yilin-3b'
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/books', `${book}.json`), 'utf8'))

/** 把不同来源的音标压成可比形式：ɹ→r、去重音符号、去可选 r、ː→: */
const strip = (s) =>
  (s || '')
    .replace(/[/[\]]/g, '')
    .replace(/ɹ/g, 'r')
    .replace(/\(r\)/g, '')
    .replace(/[ˈˌ.\s]/g, '')
    .replace(/ː/g, ':')
    .trim()
    .toLowerCase()

/** 从词条 wikitext 里取带 a=RP / a=UK 标记的第一条 IPA */
function pickRP(wikitext) {
  const re = /\{\{IPA\|en\|([^}]*)\}\}/g
  let m
  while ((m = re.exec(wikitext))) {
    const body = m[1]
    const a = (body.match(/\|a=([^|}]+)/) || [])[1] || ''
    if (!/(^|,)(RP|UK)(,|$)/i.test(a.trim())) continue
    const ipa = (body.match(/\/([^/|]+)\//) || [])[1]
    if (ipa) return { ipa, a }
  }
  return null
}

const seen = new Set()
const targets = data.words.filter((w) => {
  const k = w.word.toLowerCase()
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

const pages = new Map()
const BATCH = 10
const UA = 'SpellPal-IPA-check/1.0 (educational word-list QA)'
const CACHE = path.join(ROOT, 'scripts/data/_src', `.wikt-cache-${book}.json`)

// 网络抖得厉害，抓到的词条落盘，重跑就不用再打 API
if (fs.existsSync(CACHE)) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(CACHE, 'utf8')))) pages.set(k, v)
}

async function fetchBatch(titles) {
  const url =
    'https://en.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main' +
    `&format=json&formatversion=2&titles=${titles}`
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) })
      const text = await res.text()
      return JSON.parse(text)
    } catch (e) {
      // 限流时 API 回纯文本；网络抖动则直接 timeout，两种都退避重试
      const wait = 5000 * attempt
      console.log(`  … ${e.name === 'TimeoutError' ? '超时' : '被限流'}，${wait / 1000}s 后重试（第 ${attempt} 次）`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  console.log('  … 该批仍失败，跳过')
  return null
}

for (let i = 0; i < targets.length; i += BATCH) {
  const chunk = targets.slice(i, i + BATCH).filter((w) => !pages.has(w.word.replace(/[.,!?]/g, '').toLowerCase()))
  if (!chunk.length) continue
  const titles = chunk.map((w) => encodeURIComponent(w.word.replace(/[.,!?]/g, ''))).join('|')
  const j = await fetchBatch(titles)
  for (const p of j?.query?.pages || []) {
    pages.set(p.title.toLowerCase(), {
      exists: !p.missing,
      content: p.revisions?.[0]?.slots?.main?.content || '',
    })
  }
  fs.writeFileSync(CACHE, JSON.stringify(Object.fromEntries(pages)))
  await new Promise((r) => setTimeout(r, 1200))
}

const rows = targets.map((w) => {
  const key = w.word.replace(/[.,!?]/g, '').toLowerCase()
  const pg = pages.get(key)
  const rp = pg?.exists ? pickRP(pg.content) : null
  return {
    word: w.word,
    ours: w.phoneticUK,
    rp: rp?.ipa || '',
    label: rp?.a || '',
    exists: !!pg?.exists,
    ok: !rp || strip(rp.ipa) === strip(w.phoneticUK),
  }
})

const noPage = rows.filter((r) => !r.exists)
const diff = rows.filter((r) => r.exists && r.rp && !r.ok)
const noRP = rows.filter((r) => r.exists && !r.rp)

console.log(`核对 ${rows.length} 条（含词组）`)
console.log(`  有英式音标可比：${rows.length - noPage.length - noRP.length} 条，一致 ${rows.length - noPage.length - noRP.length - diff.length} 条`)
console.log(`\n【拼写存疑：Wiktionary 查不到词条】${noPage.length} 条`)
for (const r of noPage) console.log(`  ${r.word}`)
console.log(`\n【英式音标有差异，需人工判断】${diff.length} 条`)
for (const r of diff) console.log(`  ${r.word.padEnd(16)} 本地 ${r.ours.padEnd(20)} RP ${r.rp}  (${r.label})`)
console.log(`\n【有词条但没标 RP/UK】${noRP.length} 条`)
console.log('  ' + noRP.map((r) => r.word).join(', '))
