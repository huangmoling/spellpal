#!/usr/bin/env node
/**
 * 小拼手 SpellPal — 教材词库构建脚本
 *
 * 输入：scripts/data/{bookId}.tsv
 *   格式：unit|word|ipaUK|cnShort|cnFull|syllables
 *   说明：syllables 用 - 分隔，如 lis-ten；词组用空格分词，如 red pan-da
 *
 * 输出：src/data/books/{bookId}.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(__dirname, 'data')
const OUT_DIR = path.join(ROOT, 'src', 'data', 'books')

/** 教材元信息 + 单元主题 */
const BOOKS = {
  'pep-3a': {
    id: 'pep-3start-3a',
    title: '义务教育教科书·英语（PEP）三年级上册',
    shortTitle: '三年级上册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2024 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Making friends',
      2: 'Different families',
      3: 'Amazing animals',
      4: 'Plants around us',
      5: 'The colourful world',
      6: 'Useful numbers',
    },
  },
  'pep-3b': {
    id: 'pep-3start-3b',
    title: '义务教育教科书·英语（PEP）三年级下册',
    shortTitle: '三年级下册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '认识新朋友 · 你从哪里来',
      2: '说说身体和动作',
      3: '用五官和文具学习',
      4: '健康的食物',
      5: '旧玩具在哪里',
      6: '生活里的数字',
    },
  },
  'pep-4a': {
    id: 'pep-4start-4a',
    title: '义务教育教科书·英语（PEP）四年级上册',
    shortTitle: '四年级上册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '家人的工作与家务',
      2: '朋友的样子和爱好',
      3: '社区里的地方',
      4: '身边的职业',
      5: '天气和户外活动',
      6: '衣服和季节',
    },
  },
  'pep-4b': {
    id: 'pep-4start-4b',
    title: '义务教育教科书·英语（PEP）四年级下册',
    shortTitle: '四年级下册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2026 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '教室里的规则与帮忙',
      2: '在家能做的小事',
      3: '一天的作息',
      4: '买衣服',
      5: '农场和菜园',
      6: '摆餐桌与数数',
    },
  },
  'pep-5a': {
    id: 'pep-5start-5a',
    title: '义务教育教科书·英语（PEP）五年级上册',
    shortTitle: '五年级上册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '新朋友和新老师',
      2: '说说心里的感受',
      3: '一周的课和周末',
      4: '健康的小习惯',
      5: '食物和植物的样子',
      6: '出门看大自然',
    },
  },
  'pep-5b': {
    id: 'pep-5start-5b',
    title: '义务教育教科书·英语（PEP）五年级下册',
    shortTitle: '五年级下册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2026 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '遵守规则',
      2: '街道和问路',
      3: '月份和节日',
      4: '家乡和旅行',
      5: '出行和健康',
      6: '上网和旅游',
    },
  },
  'pep-6a': {
    id: 'pep-6start-6a',
    title: '义务教育教科书·英语（PEP）六年级上册',
    shortTitle: '六年级上册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '我去过的地方',
      2: '校园活动和节日',
      3: '生病和照顾',
      4: '零花钱怎么花',
      5: '太空和地球',
      6: '节约能源',
    },
  },
  'starter-phonics': {
    id: 'starter-phonics',
    title: '自然拼读起步（小拼手启蒙）',
    shortTitle: '拼读起步',
    publisher: '小拼手自编',
    series: '启蒙路径',
    grade: 0,
    term: 'up',
    edition: 'L0 · 自然拼读',
    stage: 'starter',
    unitThemes: {
      1: '字母 a 的音 /æ/',
      2: '字母 e 的音 /e/',
      3: '字母 i 的音 /ɪ/',
      4: '字母 o 的音 /ɒ/',
      5: '字母 u 的音 /ʌ/',
      6: '最常用的六个小词',
    },
  },
  'pep-1start-1a': {
    id: 'pep-1start-1a',
    title: '义务教育教科书·英语（一年级起点）一年级上册',
    shortTitle: '一年级上册',
    publisher: '人民教育出版社',
    series: '一年级起点',
    grade: 1,
    term: 'up',
    edition: 'L2 · 主题词',
    stage: 'starter',
    unitThemes: {
      1: '文具和书',
      2: '我的脸',
      3: '小动物',
      4: '数字 1–10',
      5: '颜色',
      6: '水果',
    },
  },
  'pep-1start-1b': {
    id: 'pep-1start-1b',
    title: '义务教育教科书·英语（一年级起点）一年级下册',
    shortTitle: '一年级下册',
    publisher: '人民教育出版社',
    series: '一年级起点',
    grade: 1,
    term: 'down',
    edition: 'L3 · 主题词',
    stage: 'starter',
    unitThemes: {
      1: '教室里的东西',
      2: '我的房间',
      3: '我的玩具',
      4: '吃的东西',
      5: '喝的东西',
      6: '我的衣服',
    },
  },
  'pep-2start-2a': {
    id: 'pep-2start-2a',
    title: '义务教育教科书·英语（一年级起点）二年级上册',
    shortTitle: '二年级上册',
    publisher: '人民教育出版社',
    series: '一年级起点',
    grade: 2,
    term: 'up',
    edition: 'L3 · 主题词',
    stage: 'starter',
    unitThemes: {
      1: '我的家人',
      2: '男孩和女孩',
      3: '我的朋友',
      4: '我住的地方',
      5: '公园里',
      6: '节日',
    },
  },
  'pep-2start-2b': {
    id: 'pep-2start-2b',
    title: '义务教育教科书·英语（一年级起点）二年级下册',
    shortTitle: '二年级下册',
    publisher: '人民教育出版社',
    series: '一年级起点',
    grade: 2,
    term: 'down',
    edition: 'L3 · 主题词',
    stage: 'starter',
    unitThemes: {
      1: '玩和运动',
      2: '天气',
      3: '季节',
      4: '时间',
      5: '一天的作息',
      6: '一周的日子',
    },
  },
}

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const rows = []
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  lines.forEach((line, i) => {
    const [unit, word, ipa, cn, cnFull, syl] = line.split('|')
    if (!unit || !word) throw new Error(`第 ${i + 1} 行格式错误: ${line}`)
    rows.push({
      unit: Number(unit),
      word: word.trim(),
      phoneticUK: ipa?.trim() || '',
      cnShort: cn?.trim() || '',
      cnFull: cnFull?.trim() || cn?.trim() || '',
      syllables: (syl || word).trim().split('-').map((s) => s.trim()).filter(Boolean),    })
  })
  return rows
}

/**
 * 句子源文件：scripts/data/sentences-{bookId}.tsv
 * 格式（TAB 分隔）：unit \t 中文整句 \t 英文句子 \t 词性1|词性2… \t 中文1|中文2…
 * 英文按空格切词，词性与中文用 | 分段，段数必须与切词结果一致。
 */
function parseSentences(file, bookId, unitThemes) {
  if (!fs.existsSync(file)) return []
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const out = []
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  const seq = {}
  lines.forEach((line, i) => {
    const cols = line.split('\t')
    if (cols.length < 5) throw new Error(`句子第 ${i + 1} 行列数不足（需 5 列 TAB 分隔）: ${line}`)
    const [unitRaw, cn, en, posRaw, cnRaw] = cols
    const unit = Number(unitRaw)
    const parts = en.trim().split(/\s+/)
    const poses = posRaw.split('|').map((s) => s.trim())
    const cns = cnRaw.split('|').map((s) => s.trim())
    if (poses.length !== parts.length) {
      throw new Error(`句子第 ${i + 1} 行词性数 ${poses.length} ≠ 词数 ${parts.length}: ${en}`)
    }
    if (cns.length !== parts.length) {
      throw new Error(`句子第 ${i + 1} 行中文数 ${cns.length} ≠ 词数 ${parts.length}: ${en}`)
    }
    seq[unit] = (seq[unit] || 0) + 1
    out.push({
      id: `${bookId}-u${unit}-s${String(seq[unit]).padStart(2, '0')}`,
      unit,
      cn: cn.trim(),
      en: parts.join(' '),
      tokens: parts.map((p, k) => ({ en: p, cn: cns[k], pos: poses[k] })),
      _theme: unitThemes?.[unit] || '',
    })
  })
  return out
}

function build(bookId) {
  const meta = BOOKS[bookId]
  if (!meta) throw new Error(`未定义的教材: ${bookId}`)
  const rows = parse(path.join(SRC_DIR, `${bookId}.tsv`))

  /** 同单元内序号，处理 orange 这类跨单元重复词 */
  const seq = {}
  const words = rows.map((r) => {
    seq[r.unit] = (seq[r.unit] || 0) + 1
    const id = `${meta.id}-u${r.unit}-${String(seq[r.unit]).padStart(2, '0')}`
    return {
      id,
      word: r.word,
      phoneticUK: r.phoneticUK,
      syllables: r.syllables,
      senses: [{ cn: r.cnShort, cnFull: r.cnFull }],
      grade: meta.grade,
      unit: r.unit,
    }
  })

  const unitNos = [...new Set(rows.map((r) => r.unit))].sort((a, b) => a - b)
  const units = unitNos.map((no) => ({
    no,
    title: `Unit ${no}`,
    theme: meta.unitThemes?.[no] || '',
    wordIds: words.filter((w) => w.unit === no).map((w) => w.id),
  }))

  const sentences = parseSentences(
    path.join(SRC_DIR, `sentences-${bookId}.tsv`),
    meta.id,
    meta.unitThemes,
  )
  sentences.forEach((s) => delete s._theme)

  // ---- 校验 ----
  const errs = []
  /** 归一化：撇号、连字符、空格都不参与比对（这些字符孩子不用敲） */
  const norm = (s) => s.toLowerCase().replace(/['’\s-]/g, '')
  for (const w of words) {
    const joined = norm(w.syllables.join(''))
    const target = norm(w.word)
    if (joined !== target) errs.push(`音节拼接不符: ${w.word} -> ${w.syllables.join('-')}`)
    if (!w.phoneticUK) errs.push(`缺少音标: ${w.word}`)
    if (!w.senses[0].cn) errs.push(`缺少释义: ${w.word}`)
    if (w.senses[0].cn.length > 12) errs.push(`释义过长(${w.senses[0].cn.length}字): ${w.word}`)
    if (/^(n|v|vt|vi|adj|adv|pron|prep|conj|num)\./.test(w.senses[0].cn)) {
      errs.push(`释义仍含词典标记: ${w.word}`)
    }
  }
  if (errs.length) {
    console.error('✗ 校验失败:')
    errs.forEach((e) => console.error('  -', e))
    process.exitCode = 1
    return
  }

  // ---- 句子校验 ----
  const sEnts = []
  for (const s of sentences) {
    if (!s.cn) sEnts.push(`句子缺中文: ${s.en}`)
    if (!s.en) sEnts.push(`句子缺英文: ${s.cn}`)
    if (s.tokens.length < 2) sEnts.push(`句子过短（至少 2 词）: ${s.en}`)
    if (/[，。！？、；：]/.test(s.en)) sEnts.push(`英文句子里混入中文标点: ${s.en}`)
    for (const t of s.tokens) {
      if (!t.cn) sEnts.push(`词块缺中文: ${s.en} / ${t.en}`)
      if (!t.pos) sEnts.push(`词块缺词性: ${s.en} / ${t.en}`)
      if (/[，。！？、；：|]/.test(t.cn)) sEnts.push(`词块中文含标点: ${s.en} / ${t.en} -> ${t.cn}`)
    }
  }
  const unitsWithSentence = new Set(sentences.map((s) => s.unit))
  for (const no of unitNos) {
    if (!unitsWithSentence.has(no)) sEnts.push(`Unit ${no} 没有任何例句`)
  }
  if (sEnts.length) {
    console.error('✗ 句子校验失败:')
    sEnts.forEach((e) => console.error('  -', e))
    process.exitCode = 1
    return
  }

  const sentenceCount = sentences.length
  const out = {
    ...meta,
    unitThemes: undefined,
    wordCount: words.length,
    sentenceCount,
    updatedAt: new Date().toISOString().slice(0, 10),
    units,
    words,
    sentences,
  }
  delete out.unitThemes

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outFile = path.join(OUT_DIR, `${meta.id}.json`)
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8')
  console.log(
    `✓ ${meta.id}  ${words.length} 词 / ${sentenceCount} 句 / ${units.length} 单元  ->  ${path.relative(ROOT, outFile)}  (${(
      fs.statSync(outFile).size / 1024
    ).toFixed(1)} KB)`,
  )
  units.forEach((u) => {
    const n = sentences.filter((s) => s.unit === u.no).length
    console.log(`   Unit ${u.no}  ${u.theme}  ${u.wordIds.length} 词 / ${n} 句`)
  })
}

const targets = process.argv.slice(2)
if (targets.length === 0) Object.keys(BOOKS).forEach(build)
else targets.forEach(build)
