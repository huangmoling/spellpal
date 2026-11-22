# -*- coding: utf-8 -*-
"""2026 秋「下册」批量词表构建器。

每种版式一个 mode：
  blocks  —— 「Unit N」标题 + 词条块（沪教/湘少/教科/译林）
  tab     —— 词形 TAB 换行释义（川教）
  alpha   —— 字母序 + 课本页码，单元靠目录页范围反查（冀教/清华）
  lesson  —— 「Lesson N」标题 + 词条块，课次映射单元（北京）
  ls      —— 双栏坐标配对（辽师大）
"""
import os, re, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_common import pages, parse_blocks, dedupe, norm_key, split_entry, CJK
from parse_alpha import parse as alpha_parse

HERE = os.path.dirname(os.path.abspath(__file__))
MARK = re.compile(r'(Word\s*lists?|WORD\s*LIST|Words\s+and\s+expressions|Vocabulary|VOCABULARY|'
                  r'词汇表|单词表|生词表|My\s+Vocabulary\s+Bank)', re.I)
STOP = re.compile(r'(本表按字母顺序|索引|Index|Word\s*list\s*[（(]?\s*(Ⅱ|II)|'
                  r'\bA\s+B\s+C\s+D\b)')


def unit_ranges_from_dash(key, pages_rng):
    """冀教版目录：'1-12' '13-24' 这样的页码范围。"""
    pg = pages(key)
    txt = ''.join(pg.get(p, '') for p in pages_rng)
    out = []
    for m in re.finditer(r'(\d{1,3})\s*[-–—]\s*(\d{1,3})', txt):
        a, b = int(m.group(1)), int(m.group(2))
        if 0 < a < b <= 120 and (not out or a > out[-1][1]):
            out.append((a, b))
    return out


def unit_starts_from_contents(key, pages_rng, n_units):
    """清华版目录：'UNIT 1 ... 1' 这样的起始页。"""
    pg = pages(key)
    txt = ''.join(pg.get(p, '') + '\n' for p in pages_rng)
    starts = []
    for m in re.finditer(r'UNIT\s*(\d+)([^\n]*?)(\d{1,2})(?=\s|\n|$)', txt, re.I):
        u, tail, num = int(m.group(1)), m.group(2), int(m.group(3))
        if u == len(starts) + 1:
            starts.append(num)
    if len(starts) != n_units:
        return None
    return [(starts[i], (starts[i + 1] - 1) if i + 1 < len(starts) else 999)
            for i in range(len(starts))]


def assign_unit(page, ranges):
    if page is None:
        return 0
    for i, (a, b) in enumerate(ranges, 1):
        if a <= page <= b:
            return i
    return 0


def find_start(key, lo_frac=0.45):
    pg = pages(key)
    ks = sorted(pg)
    n = max(ks)
    cand = [p for p in ks if p > n * lo_frac and MARK.search(pg[p])]
    return cand


def parse_blocks_range(key, p0, span, unit_re=r'^\s*\d*\s*[UJ]nit\s*(\d+)'):
    by = {}
    pg = pages(key)
    for p in range(p0, p0 + span):
        if p not in pg:
            break
        body = pg[p]
        cuts = [m.start() for m in re.finditer(r'(?m)^\s*(II|Ⅱ)\s*$', body)]
        cuts += [m.start() for m in re.finditer(r'本表按字母顺序|按字母顺序收录', body)]
        if cuts:
            body = body[:min(cuts)]
            by[p] = body
            break
        by[p] = body
    import parse_common as pc
    old = pc.pages
    pc.pages = lambda k: by if k == key else old(k)
    try:
        rows = parse_blocks(key, p0, p0 + span - 1, unit_re=unit_re)
    finally:
        pc.pages = old
    return rows


def parse_tab(key, p_from, p_to, unit_re=r'^\s*(?:Module\s*[A-Z0-9]+\s*)?Unit\s*(\d+)'):
    """川教版：'word\\t' 换行 '释义'；表里还混着句型（含句末标点或首字母大写多词）。"""
    pg = pages(key)
    cur = 0
    out = []
    for p in range(p_from, p_to + 1):
        lines = pg.get(p, '').split('\n')
        i = 0
        while i < len(lines):
            raw = lines[i]
            s = raw.strip()
            if not s:
                i += 1
                continue
            m = re.match(unit_re, s)
            if m:
                cur = int(m.group(1))
                i += 1
                continue
            if re.match(r'^Module\s', s) or re.match(r'^Challenge Yourself', s):
                i += 1
                continue
            if re.match(r'^(Vocabulary|Word List|My Vocabulary Bank)', s, re.I):
                cur = 0
                i += 1
                continue
                i += 1
                continue
            if raw.rstrip(' ').endswith('\t'):
                head = raw.rstrip('\t ').strip()
                head = re.sub(r'^[*＊]\s*', '', head)
                gloss = ''
                j = i + 1
                while j < len(lines) and lines[j].strip() and CJK.search(lines[j]):
                    gloss += lines[j].strip()
                    j += 1
                if head and gloss:
                    out.append([cur, head, gloss, False, None])
                i = j
                continue
            i += 1
    return out


def parse_lesson(key, p_from, p_to):
    """北京版：'Lesson N' 分块，词形后跟释义。"""
    pg = pages(key)
    cur = 0
    out = []
    LSN = re.compile(r'^Lesson\s*(\d+)', re.I)
    for p in range(p_from, p_to + 1):
        lines = pg.get(p, '').split('\n')
        for ln in lines:
            s = ln.replace('\u2003', '  ').strip()
            if not s:
                continue
            m = LSN.match(s)
            if m:
                cur = int(m.group(1))
                continue
            if re.match(r'^WORD\s*LIST', s, re.I) or re.match(r'^Unit\s+\w+', s):
                continue
            got = split_entry(ln)
            if got:
                head, tail, star = got
                out.append([cur, head, tail, star, None])
    # 释义折行：紧邻下一行是纯汉字且上一行 tail 为空
    merged = []
    for row in out:
        if merged and not merged[-1][2] and CJK.fullmatch(row[1] or ''):
            merged[-1][2] = row[1]
            continue
        merged.append(row)
    return merged
