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
const THEME_DIR = path.join(SRC_DIR, '_src', 'themes')

/**
 * 单元要点表：scripts/data/_src/themes/*.tsv
 * 每行 bookId \t 单元号 \t 中文要点 \t 英文要点
 * 中文是界面主标题，英文做副标题（参考人教 PEP / 外研新标准两套的写法）。
 */
const THEMES = (() => {
  const map = new Map()
  if (!fs.existsSync(THEME_DIR)) return map
  for (const f of fs.readdirSync(THEME_DIR)) {
    if (!f.endsWith('.tsv')) continue
    const raw = fs.readFileSync(path.join(THEME_DIR, f), 'utf8').replace(/^\uFEFF/, '')
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue
      const [book, no, cn, en] = line.split('\t')
      if (!book || !no) continue
      map.set(`${book.trim()}#${Number(no)}`, {
        cn: (cn || '').trim(),
        en: (en || '').trim(),
      })
    }
  }
  return map
})()

/** 打印时提示哪些单元还没写要点，避免静默漏掉 */
const missingTheme = new Set()

function themeOf(bookId, meta, no) {
  const hit = THEMES.get(`${bookId}#${no}`)
  const cn = hit?.cn || meta.unitThemes?.[no] || ''
  const en = hit?.en || ''
  if (!cn) missingTheme.add(`${bookId} u${no}`)
  return { cn, en }
}

/**
 * 孤立单元归并：unit 0 是 PDF 解析时落在外面的零散词，按语义并进正片单元。
 * 归并之后再统一重排成 1..N，保证界面上不会出现 0 号或跳号。
 */
const UNIT_MERGE = {
  'jj-3a': { 0: 5 }, // happy / short / so → About me
  'jj-4a': { 0: 3 }, // cheer / proud / basketball → Sports
  'qh-2b': { 0: 2 }, // angry / future → FEELINGS
  'qh-3a': { 0: 1 }, // am / are / has / play → OUR SCHOOL
  'jk-3b': { 0: 1 }, // 起居与值日短语 → 日常作息
}


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
  'pep-6b': {
    id: 'pep-6start-6b',
    title: '义务教育教科书·英语（PEP）六年级下册',
    shortTitle: '六年级下册',
    publisher: '人民教育出版社',
    series: 'PEP（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '新课标修订版',
    stage: 'primary',
  },

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
  'fltrp-6b': {
    id: 'fltrp-6b',
    title: '义务教育教科书·英语（新标准）六年级下册',
    shortTitle: '六下·外研',
    publisher: '外语教学与研究出版社',
    series: '外研版（新标准）',
    grade: 6,
    term: 'down',
    edition: '新课标修订版',
    stage: 'primary',
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
  'bj-2a': {
    id: 'bj-2a',
    title: '义务教育教科书·英语（北京）二年级上册',
    shortTitle: '二年级上册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 2,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'bj-2b': {
    id: 'bj-2b',
    title: '义务教育教科书·英语（北京）二年级下册',
    shortTitle: '二年级下册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 2,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'bj-3b': {
    id: 'bj-3b',
    title: '义务教育教科书·英语（北京）三年级下册',
    shortTitle: '三年级下册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      5: '',
      6: '',
      7: '',
    },
  },
  'bj-4b': {
    id: 'bj-4b',
    title: '义务教育教科书·英语（北京）四年级下册',
    shortTitle: '四年级下册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      5: '',
      6: '',
      7: '',
    },
  },
  'bj-5b': {
    id: 'bj-5b',
    title: '义务教育教科书·英语（北京）五年级下册',
    shortTitle: '五年级下册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      5: '',
      6: '',
      7: '',
    },
  },
  'bj-6a': {
    id: 'bj-6a',
    title: '义务教育教科书·英语（北京）六年级上册',
    shortTitle: '六年级上册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      5: '',
      6: '',
      7: '',
    },
  },
  'bj-6b': {
    id: 'bj-6b',
    title: '义务教育教科书·英语（北京）六年级下册',
    shortTitle: '六年级下册',
    publisher: '北京出版社',
    series: '北京版（一年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
    },
  },
  'bsd-3a': {
    id: 'bsd-3a',
    title: '义务教育教科书·英语（北师大）三年级上册',
    shortTitle: '三年级上册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
    },
  },
  'bsd-3b': {
    id: 'bsd-3b',
    title: '义务教育教科书·英语（北师大）三年级下册',
    shortTitle: '三年级下册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
    },
  },
  'bsd-4a': {
    id: 'bsd-4a',
    title: '义务教育教科书·英语（北师大）四年级上册',
    shortTitle: '四年级上册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'bsd-4b': {
    id: 'bsd-4b',
    title: '义务教育教科书·英语（北师大）四年级下册',
    shortTitle: '四年级下册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
    },
  },
  'bsd-5a': {
    id: 'bsd-5a',
    title: '义务教育教科书·英语（北师大）五年级上册',
    shortTitle: '五年级上册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'bsd-5b': {
    id: 'bsd-5b',
    title: '义务教育教科书·英语（北师大）五年级下册',
    shortTitle: '五年级下册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      7: '',
      8: '',
      9: '',
      10: '',
      11: '',
      12: '',
    },
  },
  'bsd-6a': {
    id: 'bsd-6a',
    title: '义务教育教科书·英语（北师大）六年级上册',
    shortTitle: '六年级上册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'bsd-6b': {
    id: 'bsd-6b',
    title: '义务教育教科书·英语（北师大）六年级下册',
    shortTitle: '六年级下册',
    publisher: '北京师范大学出版社',
    series: '北师大版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      7: '',
      8: '',
      9: '',
    },
  },
  'cj-3a': {
    id: 'cj-3a',
    title: '义务教育教科书·英语（川教）三年级上册',
    shortTitle: '三年级上册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Good Morning!',
      2: 'I’m Li Le',
      3: 'I Can Sing',
      4: 'What Colour Is It?',
      5: 'Look at My Picture',
      6: 'What’s Your Favourite Colour?',
      7: 'How Old Are You?',
      8: 'Can I Help You?',
      9: 'I Like Fruit Salad',
    },
  },
  'cj-4a': {
    id: 'cj-4a',
    title: '义务教育教科书·英语（川教）四年级上册',
    shortTitle: '四年级上册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Don’t Pick the Flowers!',
      2: 'Follow the Rules',
      3: 'What Should We Do?',
      4: 'How’s the Weather?',
      5: 'What Season Is It?',
      6: 'What’s Your Favourite Season?',
    },
  },
  'cj-4b': {
    id: 'cj-4b',
    title: '义务教育教科书·英语（川教）四年级下册',
    shortTitle: '四年级下册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Meeting a New Teacher',
      2: 'Having a Picnic',
      3: 'Visiting a Zoo',
    },
  },
  'cj-5a': {
    id: 'cj-5a',
    title: '义务教育教科书·英语（川教）五年级上册',
    shortTitle: '五年级上册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
    },
  },
  'cj-5b': {
    id: 'cj-5b',
    title: '义务教育教科书·英语（川教）五年级下册',
    shortTitle: '五年级下册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'We Love Nature',
      2: 'Four Seasons',
      3: 'A Birthday Party',
    },
  },
  'cj-6a': {
    id: 'cj-6a',
    title: '义务教育教科书·英语（川教）六年级上册',
    shortTitle: '六年级上册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
    },
  },
  'cj-6b': {
    id: 'cj-6b',
    title: '义务教育教科书·英语（川教）六年级下册',
    shortTitle: '六年级下册',
    publisher: '四川教育出版社',
    series: '川教版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Different Jobs',
      2: 'Colourful Life',
      3: 'Magic World',
    },
  },
  'hj-4b': {
    id: 'hj-4b',
    title: '义务教育教科书·英语（沪教）四年级下册',
    shortTitle: '四年级下册',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
    },
  },
  'hj-5b': {
    id: 'hj-5b',
    title: '义务教育教科书·英语（沪教）五年级下册',
    shortTitle: '五年级下册',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
      9: '',
      10: '',
      11: '',
      12: '',
    },
  },
  'hj-6a': {
    id: 'hj-6a',
    title: '义务教育教科书·英语（沪教）六年级上册',
    shortTitle: '六年级上册',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
      9: '',
      10: '',
      11: '',
      12: '',
    },
  },
  'hj-6b': {
    id: 'hj-6b',
    title: '义务教育教科书·英语（沪教）六年级下册',
    shortTitle: '六年级下册',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
      9: '',
      10: '',
      11: '',
      12: '',
    },
  },
  'jj-3a': {
    id: 'jj-3a',
    title: '义务教育教科书·英语（冀教）三年级上册',
    shortTitle: '三年级上册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Hello!',
      2: 'My school',
      3: 'Colours and letters',
      4: 'My friends',
      5: 'About me',
      6: 'My family',
    },
  },
  'jj-4a': {
    id: 'jj-4a',
    title: '义务教育教科书·英语（冀教）四年级上册',
    shortTitle: '四年级上册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'School life',
      2: 'School rules',
      3: 'Sports',
      4: 'Jobs',
      5: 'Meet my family',
      6: 'More about me',
    },
  },
  'jj-4b': {
    id: 'jj-4b',
    title: '义务教育教科书·英语（冀教）四年级下册',
    shortTitle: '四年级下册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'jj-5a': {
    id: 'jj-5a',
    title: '义务教育教科书·英语（冀教）五年级上册',
    shortTitle: '五年级上册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'jj-5b': {
    id: 'jj-5b',
    title: '义务教育教科书·英语（冀教）五年级下册',
    shortTitle: '五年级下册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'jj-6a': {
    id: 'jj-6a',
    title: '义务教育教科书·英语（冀教）六年级上册',
    shortTitle: '六年级上册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'jj-6b': {
    id: 'jj-6b',
    title: '义务教育教科书·英语（冀教）六年级下册',
    shortTitle: '六年级下册',
    publisher: '河北教育出版社',
    series: '冀教版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'jk-3b': {
    id: 'jk-3b',
    title: '义务教育教科书·英语（教科）三年级下册',
    shortTitle: '三年级下册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 3,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
    },
  },
  'jk-4b': {
    id: 'jk-4b',
    title: '义务教育教科书·英语（教科）四年级下册',
    shortTitle: '四年级下册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
    },
  },
  'jk-5b': {
    id: 'jk-5b',
    title: '义务教育教科书·英语（教科）五年级下册',
    shortTitle: '五年级下册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
      9: '',
      10: '',
      11: '',
      12: '',
    },
  },
  'jk-6b': {
    id: 'jk-6b',
    title: '义务教育教科书·英语（教科）六年级下册',
    shortTitle: '六年级下册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
    },
  },
  'ls-3a': {
    id: 'ls-3a',
    title: '义务教育教科书·英语（辽师大）三年级上册',
    shortTitle: '三年级上册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '结束会议',
      2: 'Start!',
    },
  },
  'ls-4a': {
    id: 'ls-4a',
    title: '义务教育教科书·英语（辽师大）四年级上册',
    shortTitle: '四年级上册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
    },
  },
  'ls-4b': {
    id: 'ls-4b',
    title: '义务教育教科书·英语（辽师大）四年级下册',
    shortTitle: '四年级下册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Welcome to our home!',
      2: 'Look at my family photo',
      3: 'He’s our PE teacher',
      4: 'I have a new friend',
      5: 'My father is great',
      6: 'They are artists',
      7: 'What are they?',
      8: 'They are sweet potatoes',
      9: 'I can fly',
      10: 'Can you sing and dance?',
      11: 'He can play the guitar',
      12: 'Good habits',
    },
  },
  'ls-5a': {
    id: 'ls-5a',
    title: '义务教育教科书·英语（辽师大）五年级上册',
    shortTitle: '五年级上册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Do you like computer class?',
      2: 'What subject do you like?',
      3: 'What day is today?',
      4: 'What’s your favorite day?',
      5: 'Pass me a hamburger, please',
      6: 'Can I have some chicken?',
      7: 'What would you like?',
    },
  },
  'ls-5b': {
    id: 'ls-5b',
    title: '义务教育教科书·英语（辽师大）五年级下册',
    shortTitle: '五年级下册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'My new school',
      2: 'Visiting a school',
      3: 'My community',
      4: 'In the fields',
      5: 'My day',
      6: 'On duty',
      7: 'After school',
      8: 'On weekends',
      9: 'A busy family',
      10: 'Cleaning my room',
      11: 'Calling home',
      12: 'Having fun',
    },
  },
  'ls-6a': {
    id: 'ls-6a',
    title: '义务教育教科书·英语（辽师大）六年级上册',
    shortTitle: '六年级上册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Whose umbrella is it?',
      7: 'What are you going to do?',
    },
  },
  'ls-6b': {
    id: 'ls-6b',
    title: '义务教育教科书·英语（辽师大）六年级下册',
    shortTitle: '六年级下册',
    publisher: '辽宁师范大学出版社',
    series: '辽师大版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Back to school',
      7: 'My animal sign',
      9: 'A different weekend',
      10: 'A birthday party',
      12: 'Sports games',
    },
  },
  'qh-2a': {
    id: 'qh-2a',
    title: '义务教育教科书·英语（清华）二年级上册',
    shortTitle: '二年级上册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 2,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'qh-2b': {
    id: 'qh-2b',
    title: '义务教育教科书·英语（清华）二年级下册',
    shortTitle: '二年级下册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 2,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'SHAPES',
      2: 'FEELINGS',
      3: 'JOBS',
      4: 'SEASONS',
    },
  },
  'qh-3a': {
    id: 'qh-3a',
    title: '义务教育教科书·英语（清华）三年级上册',
    shortTitle: '三年级上册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'OUR SCHOOL',
      2: 'OUR COMMUNITY',
      3: 'OUR LIFE',
      4: 'SEASONS',
      5: 'HOLIDAYS',
    },
  },
  'qh-4a': {
    id: 'qh-4a',
    title: '义务教育教科书·英语（清华）四年级上册',
    shortTitle: '四年级上册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'qh-4b': {
    id: 'qh-4b',
    title: '义务教育教科书·英语（清华）四年级下册',
    shortTitle: '四年级下册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'HOME SWEET HOME',
      2: 'GOING SOMEWHERE',
      3: 'WHEN I GROW UP',
      4: 'SEASONS AND MONTHS',
    },
  },
  'qh-5a': {
    id: 'qh-5a',
    title: '义务教育教科书·英语（清华）五年级上册',
    shortTitle: '五年级上册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'WHERE IS THIS?',
      2: 'LET’S GO SHOPPING!',
      3: 'LITTLE ELLEN’S DIARY',
      4: 'HOW MUCH DO YOU KNOW?',
    },
  },
  'qh-5b': {
    id: 'qh-5b',
    title: '义务教育教科书·英语（清华）五年级下册',
    shortTitle: '五年级下册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Welcome to My School!',
      2: 'What’s Your Hobby?',
      3: 'The Environment and Us',
      4: 'Billy’s Adventures',
    },
  },
  'qh-6a': {
    id: 'qh-6a',
    title: '义务教育教科书·英语（清华）六年级上册',
    shortTitle: '六年级上册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2025 秋 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
    },
  },
  'qh-6b': {
    id: 'qh-6b',
    title: '义务教育教科书·英语（清华）六年级下册',
    shortTitle: '六年级下册',
    publisher: '清华大学出版社',
    series: '清华版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'TELEPHONE CONVERSATIONS',
      2: 'WONDERFUL HOLIDAYS',
      3: 'GREAT PEOPLE',
      4: 'INTERESTING FABLES',
    },
  },
  'xs-4b': {
    id: 'xs-4b',
    title: '义务教育教科书·英语（湘少）四年级下册',
    shortTitle: '四年级下册',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'It’s on your head!',
      2: 'Spring is warm',
      3: 'What can you see?',
      4: 'Can you write in English?',
      5: 'Peter is writing',
      6: 'What’s Anne doing?',
      7: 'Today is Saturday',
      8: 'I come from China',
      9: 'How much is it?',
    },
  },
  'xs-5b': {
    id: 'xs-5b',
    title: '义务教育教科书·英语（湘少）五年级下册',
    shortTitle: '五年级下册',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'We’re going to read stories',
      2: 'We’re going to do some research',
      3: 'Let’s make a kite',
      4: 'Don’t talk here',
      5: 'When’s your birthday?',
      6: 'I’ll make a beautiful card',
      7: 'There’s a post office near my school',
      8: 'Can you show me the way to the zoo',
      9: 'He’s kind to children',
    },
  },
  'xs-6b': {
    id: 'xs-6b',
    title: '义务教育教科书·英语（湘少）六年级下册',
    shortTitle: '六年级下册',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
      9: '',
    },
  },
  'yl-4b': {
    id: 'yl-4b',
    title: '义务教育教科书·英语（译林）四年级下册',
    shortTitle: '四下·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 4,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: '',
      2: '',
      3: '',
      4: '',
      5: '',
      6: '',
      7: '',
      8: '',
    },
  },
  'yl-5b': {
    id: 'yl-5b',
    title: '义务教育教科书·英语（译林）五年级下册',
    shortTitle: '五下·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 5,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'Cinderella',
      2: 'How do you come to school?',
      3: 'Asking the way',
      4: 'Seeing the doctor',
      5: 'Helping our parents',
      6: 'In the kitchen',
    },
  },
  'yl-6a': {
    id: 'yl-6a',
    title: '义务教育教科书·英语（译林）六年级上册',
    shortTitle: '六上·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '新课标修订版',
    stage: 'primary',
  },

  'yl-6b': {
    id: 'yl-6b',
    title: '义务教育教科书·英语（译林）六年级下册',
    shortTitle: '六下·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 6,
    term: 'down',
    edition: '2025 春 · 新课标修订版',
    stage: 'primary',
    unitThemes: {
      1: 'The lion and the mouse',
      2: 'Good habits',
      3: 'A healthy diet',
      4: 'Road safety',
      5: 'A party',
      6: 'An interesting country',
    },
  },

  // ---- 2026 秋补齐的上册（词表来自 _src/tb2026，要点见 _src/themes/newbooks.tsv）----
  'bj-3a': {
    id: 'bj-3a',
    title: '义务教育教科书·英语（北京）三年级上册',
    shortTitle: '三年级上册',
    publisher: '北京出版社',
    series: '北京版',
    grade: 3,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'bj-4a': {
    id: 'bj-4a',
    title: '义务教育教科书·英语（北京）四年级上册',
    shortTitle: '四年级上册',
    publisher: '北京出版社',
    series: '北京版',
    grade: 4,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'bj-5a': {
    id: 'bj-5a',
    title: '义务教育教科书·英语（北京）五年级上册',
    shortTitle: '五年级上册',
    publisher: '北京出版社',
    series: '北京版',
    grade: 5,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'hj-3a': {
    id: 'hj-3a',
    title: '义务教育教科书·英语（沪教版）三年级上册',
    shortTitle: '三上·沪教',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'hj-4a': {
    id: 'hj-4a',
    title: '义务教育教科书·英语（沪教）四年级上册',
    shortTitle: '四年级上册',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'hj-5a': {
    id: 'hj-5a',
    title: '义务教育教科书·英语（沪教）五年级上册',
    shortTitle: '五年级上册',
    publisher: '上海教育出版社',
    series: '沪教版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'jk-3a': {
    id: 'jk-3a',
    title: '义务教育教科书·英语（教科）三年级上册',
    shortTitle: '三年级上册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'jk-4a': {
    id: 'jk-4a',
    title: '义务教育教科书·英语（教科）四年级上册',
    shortTitle: '四年级上册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'jk-5a': {
    id: 'jk-5a',
    title: '义务教育教科书·英语（教科）五年级上册',
    shortTitle: '五年级上册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'jk-6a': {
    id: 'jk-6a',
    title: '义务教育教科书·英语（教科）六年级上册',
    shortTitle: '六年级上册',
    publisher: '教育科学出版社',
    series: '教科版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'xs-3a': {
    id: 'xs-3a',
    title: '义务教育教科书·英语（湘少版）三年级上册',
    shortTitle: '三上·湘少',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 3,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'xs-4a': {
    id: 'xs-4a',
    title: '义务教育教科书·英语（湘少）四年级上册',
    shortTitle: '四年级上册',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'xs-5a': {
    id: 'xs-5a',
    title: '义务教育教科书·英语（湘少）五年级上册',
    shortTitle: '五年级上册',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'xs-6a': {
    id: 'xs-6a',
    title: '义务教育教科书·英语（湘少）六年级上册',
    shortTitle: '六年级上册',
    publisher: '湖南少年儿童出版社',
    series: '湘少版（三年级起点）',
    grade: 6,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'yl-4a': {
    id: 'yl-4a',
    title: '义务教育教科书·英语（译林）四年级上册',
    shortTitle: '四上·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 4,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
  },
  'yl-5a': {
    id: 'yl-5a',
    title: '义务教育教科书·英语（译林）五年级上册',
    shortTitle: '五上·译林',
    publisher: '译林出版社',
    series: '译林版（三年级起点）',
    grade: 5,
    term: 'up',
    edition: '2026 秋 · 新课标修订版',
    stage: 'primary',
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
function shortCn(cn) {
  // 词块下方只放一个简短义项：多义项被 、，； 分隔时取第一个
  const s = String(cn || '').trim()
  const first = s.split(/[、，；;]/)[0].trim()
  return first || s
}

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
      tokens: parts.map((p, k) => ({ en: p, cn: shortCn(cns[k]), pos: poses[k] })),
      _theme: unitThemes?.[unit] || '',
    })
  })
  return out
}

function build(bookId) {
  const meta = BOOKS[bookId]
  if (!meta) throw new Error(`未定义的教材: ${bookId}`)
  const rows = parse(path.join(SRC_DIR, `${bookId}.tsv`))

  // ---- 单元号归一：先并孤立单元，再压成 1..N ----
  const merge = UNIT_MERGE[bookId] || {}
  rows.forEach((r) => {
    if (merge[r.unit] !== undefined) r.unit = merge[r.unit]
  })
  const rawNos = [...new Set(rows.map((r) => r.unit))].sort((a, b) => a - b)
  const numMap = new Map(rawNos.map((n, i) => [n, i + 1]))
  /** 新号 → 原号：要点表是按教材原单元号写的，重排后要回查 */
  const oldOf = new Map([...numMap].map(([old, no]) => [no, old]))
  rows.forEach((r) => {
    r.unit = numMap.get(r.unit)
  })

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
  const units = unitNos.map((no) => {
    const { cn, en } = themeOf(bookId, meta, oldOf.get(no) ?? no)
    return {
      no,
      title: `Unit ${no}`,
      theme: cn,
      ...(en ? { themeEn: en } : {}),
      wordIds: words.filter((w) => w.unit === no).map((w) => w.id),
    }
  })

  const sentences = parseSentences(
    path.join(SRC_DIR, `sentences-${bookId}.tsv`),
    meta.id,
    meta.unitThemes,
  )
  sentences.forEach((s) => delete s._theme)

  // 句子跟单元一起重排（id 里的 uN 也重建，避免出现 u0）
  const sentSeq = {}
  sentences.forEach((s) => {
    const old = merge[s.unit] !== undefined ? merge[s.unit] : s.unit
    const no = numMap.get(old)
    if (no === undefined) return
    s.unit = no
    sentSeq[no] = (sentSeq[no] || 0) + 1
    s.id = `${meta.id}-u${no}-s${String(sentSeq[no]).padStart(2, '0')}`
  })

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
    console.warn('⚠ 校验警告:')
    errs.forEach((e) => console.warn('  -', e))
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
    console.warn('⚠ 句子校验警告:')
    sEnts.forEach((e) => console.warn('  -', e))
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
    console.log(`   Unit ${u.no}  ${u.theme}${u.themeEn ? ` / ${u.themeEn}` : ''}  ${u.wordIds.length} 词 / ${n} 句`)
  })
}

const targets = process.argv.slice(2)
if (targets.length === 0) Object.keys(BOOKS).forEach(build)
else targets.forEach(build)

if (missingTheme.size) {
  console.warn(`⚠ ${missingTheme.size} 个单元还没有中文要点：`)
  console.warn('  ' + [...missingTheme].join(', '))
}
