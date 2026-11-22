# -*- coding: utf-8 -*-
"""用课文首次出现页反推单元归属。

课本词表的单元标记经常不可靠（跨栏流、缺页、双字表互补），但课文本身是完整的：
一个词第一次出现在哪个单元的课文里，它就属于哪个单元。这是唯一对所有版式都成立的依据。

课本页 → 文件页的偏移，用「词表页的目录页码」与「词表页的实际文件页」之差求得。
"""
import re

import build2027 as B
from parse_common import pages


def make_index(key, words, body_rng):
    """返回 {词: 首次出现的文件页}。短语先整体搜，搜不到再退化成首词。"""
    pg = pages(key)
    texts = {p: pg.get(p, '') for p in body_rng}
    idx = {}
    for w in words:
        low = w.lower().strip()
        cands = [low]
        if ' ' in low:
            cands.append(low.split()[0])
        for pat_s in cands:
            base = re.sub(r'[^a-z\'’ -]', '', pat_s).strip()
            if not base:
                continue
            rx = re.compile(r'\b' + re.escape(base).replace(r'\ ', r'\s+') +
                            r'(?:s|es|ed|d|ing|ies)?\b', re.I)
            hit = None
            for p in body_rng:
                if rx.search(texts[p]):
                    hit = p
                    break
            if hit:
                idx[w] = hit
                break
    return idx


def assign_units(key, words, body_rng, ranges, offset):
    idx = make_index(key, words, body_rng)
    return {w: B.assign_unit(idx[w] - offset, ranges) for w in idx}, idx


def toc_ranges(key, pages_rng=(4, 10)):
    """目录里的 `Unit N ... 页码` → [(起, 止)] 课本页区间。

    目录行经常跨行（`Unit 2  My Country and English-speaking\nCountries …… 19`），
    所以按 `Unit N` 切段，在每段里找第一个「点线 + 数字」，而不是整行匹配。
    """
    pg = pages(key)
    txt = '\n'.join(pg.get(p, '') for p in range(pages_rng[0], pages_rng[1] + 1))
    parts = re.split(r'(Unit\s*\d{1,2})', txt, flags=re.I)
    starts = {}
    for i in range(1, len(parts) - 1, 2):
        u = int(re.search(r'\d{1,2}', parts[i]).group())
        seg = parts[i + 1][:400]
        m = re.search(r'[.·…\u2026]{2,}\s*(\d{1,3})', seg)
        if not m:
            m = re.search(r'\(\s*P\s*(\d{1,3})\s*[-–~]', seg)
        if m and u not in starts:
            starts[u] = int(m.group(1))
    if len(starts) < 3:
        return []
    us = sorted(starts)
    return [(starts[us[i]], (starts[us[i + 1]] - 1) if i + 1 < len(us) else 999)
            for i in range(len(us))]
