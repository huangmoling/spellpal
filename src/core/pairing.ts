/**
 * 单词 ↔ 例句配对 —— 纯函数，无副作用
 *
 * 一个单元里词多句少（19 册平均每单元 16 个词、3 条例句），
 * 所以「一个单词一个句子」只能做到「尽量配上」：
 * 句子里确实出现了这个词就用它，配不上就借用本单元按顺序的下一条句子。
 */

import type { Sentence } from '@/types'

/** 把句子按空格切成小写词形；标点只当分隔符 */
export function wordForms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * 一个词可能出现的屈折形式。
 * 课件例句里写的是 smiles / saved / making，词表里是 smile / save / make，
 * 只按原形比对会漏掉一大半。
 */
export function inflections(word: string): Set<string> {
  const w = word.toLowerCase()
  const out = new Set([w])
  if (w.length < 2) return out
  if (/y$/.test(w)) {
    out.add(`${w.slice(0, -1)}ies`)
    out.add(`${w.slice(0, -1)}ied`)
    out.add(`${w.slice(0, -1)}ier`)
    out.add(`${w.slice(0, -1)}iest`)
  }
  if (/(s|x|z|ch|sh|o)$/.test(w)) out.add(`${w}es`)
  out.add(`${w}s`)
  out.add(`${w}ed`)
  out.add(`${w}d`)
  out.add(`${w}ing`)
  if (/e$/.test(w)) {
    out.add(`${w.slice(0, -1)}ing`)
    out.add(`${w.slice(0, -1)}ed`)
  }
  /* 双写尾辅音：stop → stopped / stopping */
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) {
    out.add(`${w}${w.slice(-1)}ed`)
    out.add(`${w}${w.slice(-1)}ing`)
  }
  return out
}

/**
 * 这句话里是否出现了这个词。
 * 词组（pocket money、bird feeder）要求连续出现，避免 money 把 pocket money 抢走。
 */
export function sentenceHas(sent: Sentence, word: string): boolean {
  const parts = wordForms(word)
  if (!parts.length) return false
  const forms = wordForms(sent.en)
  for (let i = 0; i + parts.length <= forms.length; i++) {
    let ok = true
    for (let k = 0; k < parts.length; k += 1) {
      if (!inflections(parts[k]).has(forms[i + k])) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/**
 * 一轮练习里「哪个词用哪句」的全局分配。
 *
 * 只做逐词贪心不够：`The shopkeeper smiles at me.` 同时含 shopkeeper 和 smile，
 * 按顺序先配给 shopkeeper，smile 就只能借一句不含它的句子，孩子一眼能看出对不上。
 * 这里用增广路（Kuhn）求最大匹配，让每条被用上的例句都真的包含它配的那个词。
 *
 * @returns 词下标 → 句下标
 */
export function assignSentences(words: string[], sents: Sentence[]): Map<number, number> {
  const cand = words.map((w) =>
    sents.reduce<number[]>((acc, s, j) => {
      if (sentenceHas(s, w)) acc.push(j)
      return acc
    }, []),
  )
  /** 句子 → 占用它的词 */
  const owner = new Array<number>(sents.length).fill(-1)

  const augment = (wi: number, seen: boolean[]): boolean => {
    for (const j of cand[wi]) {
      if (seen[j]) continue
      seen[j] = true
      if (owner[j] === -1 || augment(owner[j], seen)) {
        owner[j] = wi
        return true
      }
    }
    return false
  }

  for (let i = 0; i < words.length; i += 1) augment(i, new Array(sents.length).fill(false))

  const out = new Map<number, number>()
  owner.forEach((wi, j) => {
    if (wi >= 0) out.set(wi, j)
  })
  return out
}
