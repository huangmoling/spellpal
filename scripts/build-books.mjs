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
      1: '点石成金 · 钱和存钱',
      2: '事实还是观点 · 童话',
      3: '自然奇观 · 高原和瀑布',
      4: '发明和动手做',
      5: '生病了 · 身体哪里不舒服',
      6: '文化节日 · 泼水节',
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

  /* ===== 外研版《英语》（新标准）小学修订版 =====
   * 词表来源：家长提供的 2026 秋分层教学设计课件，每课时【核心词汇】段
   * 单元号按课件出现顺序编，Unit 1 起 */
  'fltrp-3a': {
    id: 'fltrp-3a',
    title: '义务教育教科书·英语（新标准）三年级上册',
    shortTitle: '三上·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 3,
    term: 'up',
    edition: '2025 秋 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '打招呼和课堂用语',
      2: '认识新朋友',
      3: '我的文具',
      4: '颜色',
      5: '数字和数数',
      6: '我的家人',
      7: '我的家',
    },
  },
  'fltrp-3b': {
    id: 'fltrp-3b',
    title: '义务教育教科书·英语（新标准）三年级下册',
    shortTitle: '三下·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 3,
    term: 'down',
    edition: '2026 春 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '动物园里的动物',
      2: '身体部位',
      3: '食物和饮料',
      4: '我的爱好',
      5: '时间',
      6: '一周和课程',
    },
  },
  'fltrp-4a': {
    id: 'fltrp-4a',
    title: '义务教育教科书·英语（新标准）四年级上册',
    shortTitle: '四上·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '运动',
      2: '家务和帮忙',
      3: '天气',
      4: '四季',
      5: '出行方式',
      6: '身边的地方',
    },
  },
  'fltrp-4b': {
    id: 'fltrp-4b',
    title: '义务教育教科书·英语（新标准）四年级下册',
    shortTitle: '四下·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 4,
    term: 'down',
    edition: '2026 春 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '职业',
      2: '心情和感受',
      3: '才艺',
      4: '植物和生长',
      5: '学校生活',
      6: '衣服',
    },
  },
  'fltrp-5a': {
    id: 'fltrp-5a',
    title: '义务教育教科书·英语（新标准）五年级上册',
    shortTitle: '五上·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '食物和一日三餐',
      2: '材料与环保',
      3: '友谊',
      4: '目标与坚持',
      5: '未来生活',
      6: '节日',
    },
  },
  'fltrp-5b': {
    id: 'fltrp-5b',
    title: '义务教育教科书·英语（新标准）五年级下册',
    shortTitle: '五下·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 5,
    term: 'down',
    edition: '2026 春 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '长大和生日',
      2: '帮助他人',
      3: '阅读和故事',
      4: '老物件',
      5: '自然和森林',
      6: '家乡的变化',
    },
  },
  'fltrp-6a': {
    id: 'fltrp-6a',
    title: '义务教育教科书·英语（新标准）六年级上册',
    shortTitle: '六上·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 6,
    term: 'up',
    edition: '2026 秋 · 修订版',
    stage: 'primary',
    unitThemes: {
      1: '金钱和储蓄',
      2: '事实还是观点',
      3: '自然奇观',
      4: '发明和创造',
      5: '健康',
      6: '文化和旅行',
    },
  },
  'yilin-3a': {
    id: 'yilin-3a',
    title: '义务教育教科书·英语（译林版）三年级上册',
    shortTitle: '三上·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2024 秋 · 2022 课标修订版',
    stage: 'primary',
    /* 教材原名，跟 PEP 的 Making friends 一个规则：磁贴显示单元名而不是我概括的中文主题 */
    unitThemes: {
      1: 'Hello!',
      2: "What's your name?",
      3: 'Are you Su Hai?',
      4: 'This is my friend',
      5: "She's my mother",
      6: 'Is he your grandpa?',
      7: 'Happy Birthday!',
      8: 'I can do this for you',
    },
  },
  'yilin-3b': {
    id: 'yilin-3b',
    title: '义务教育教科书·英语（译林版）三年级下册',
    shortTitle: '三下·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 2022 课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'School things',
      2: 'Clean our classroom',
      3: 'School rules',
      4: 'Have fun after class',
      5: 'Fruit',
      6: 'On the farm',
      7: 'Animals',
      8: 'Colours',
    },
  },

  'jj-3b': {
    id: 'jj-3b',
    title: '义务教育教科书·英语（冀教版）三年级下册',
    shortTitle: '三下·冀教',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Food we like',
      2: 'Good food, good health',
      3: 'My day',
      4: 'On the farm',
      5: 'At the zoo',
      6: 'My week',
    },
  },
  'cj-3b': {
    id: 'cj-3b',
    title: '义务教育教科书·英语（川教版）三年级下册',
    shortTitle: '三下·川教',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'What’s This?',
      2: 'I Have a Farm',
      3: 'I Like This Dog',
      4: 'This Is My Family',
      5: 'What’s Your Job?',
      6: 'Let’s Make a Birthday Card',
      7: 'I Have Great Classmates',
      8: 'Is It the Library?',
      9: 'Who Is Your English Teacher?',
    },
  },
  'qh-3b': {
    id: 'qh-3b',
    title: '义务教育教科书·英语（清华版）三年级下册',
    shortTitle: '三下·清华',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Spring Semester Begins',
      2: 'Where Do You Want to Go?',
      3: 'Green Living',
      4: 'Habits and Rules',
    },
  },
  'hj-3b': {
    id: 'hj-3b',
    title: '义务教育教科书·英语（沪教版）三年级下册',
    shortTitle: '三下·沪教',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Hobbies',
      2: 'Activities with friends',
      3: 'Clothes',
      4: 'Sounds I hear',
      5: 'Colours',
      6: 'Rooms in my home',
      7: 'Places at school',
      8: 'Children’s Day',
    },
  },
  'xs-3b': {
    id: 'xs-3b',
    title: '义务教育教科书·英语（湘少版）三年级下册',
    shortTitle: '三下·湘少',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Greetings',
      2: 'What time is it?',
      3: 'Weather',
      4: 'Clothes',
      5: 'Numbers 13–20',
      6: 'Fruit and vegetables',
      7: 'Body parts and habits',
      8: 'Children’s Day',
      9: 'Transport',
      10: 'Jobs',
    },
  },
  'ls-3b': {
    id: 'ls-3b',
    title: '义务教育教科书·英语（辽师大版）三年级下册',
    shortTitle: '三下·辽师大',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'It’s a sunny day',
      2: 'Spring is here',
      3: 'This is beautiful',
      4: 'Good habits',
      5: 'I love it',
      6: 'Let me help you',
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
