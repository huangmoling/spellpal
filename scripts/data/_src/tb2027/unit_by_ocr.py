# -*- coding: utf-8 -*-
"""扫描件里没有单元标记的词表（教科版等）：用「课文首现页」反推单元。

步骤：
1. 全册 OCR 文本里找正文的 `Unit N` 标题行（跳过前 12 页目录区），得到单元起始页区间
2. 每个词形在全册逐页找首次出现，落到对应单元
3. 找不到的留在 unit 0
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
OUT = os.path.join(ROOT, '.tmp', 'tb2ocr')

UNIT_LINE = re.compile(r'^\s*Unit\s*(\d{1,2})\b', re.I)


def load_pages(key):
    pg = {}
    p = os.path.join(OUT, key + '.jsonl')
    for ln in open(p, encoding='utf-8'):
        o = json.loads(ln)
        pg[o['p'] + 1] = o['t']
    return pg


def unit_starts(pg, skip=6, stop=None):
    starts = []
    for p in sorted(pg):
        if p < skip or (stop and p >= stop):
            continue
        hits = [UNIT_LINE.match(l.strip()) for l in pg[p].split('\n')]
        hits = [m for m in hits if m]
        if len(hits) > 2:               # 目录页一页列好几个单元
            continue
        for m in hits:
            n = int(m.group(1))
            if not starts or starts[-1][1] != n:
                starts.append((p, n))
            break
    # 同一单元可能因页眉重复出现，只保留每单元首见
    seen, out = set(), []
    for p, n in starts:
        if n in seen or (out and p <= out[-1][0]):
            continue
        seen.add(n)
        out.append((p, n))
    return out


def assign(word, pg, starts):
    pat = re.compile(r'\b' + r'\s+'.join(re.escape(x) for x in word.split()) + r'\b', re.I)
    for p in sorted(pg):
        if pat.search(pg[p]):
            unit = 0
            for sp, n in starts:
                if p >= sp:
                    unit = n
            return unit, p
    return 0, None


def apply(key, words):
    """words: [{'word':..., 'gloss':...}] → 写入 unit"""
    pg = load_pages(key)
    starts = unit_starts(pg)
    missing = []
    for w in words:
        u, p = assign(w['word'], pg, starts)
        if u:
            w['unit'] = u
        else:
            missing.append(w['word'])
    return starts, missing


if __name__ == '__main__':
    import sys
    key = sys.argv[1]
    pg = load_pages(key)
    print('单元起始页', unit_starts(pg))
