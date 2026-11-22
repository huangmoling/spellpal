# -*- coding: utf-8 -*-
"""两张词表互补合并：一张给全量词形+释义，另一张给单元归属。

冀教的课本末尾有两张表：
- `Vocabulary`：字母序，词形 + 释义 + 课本页码，最全，但该 PDF 缺了 H-S 那段
- `Words in Each Unit`：按单元排，词形 + 释义 + 页码，条数少但单元是明写的

做法：以字母序表为骨架（词最全），单元优先取分单元表；分单元表没有的词，
用课本页码落进目录区间来定单元。分单元表里有、字母序表缺的，补回去。
"""
import re


def norm(w):
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)
    w = re.sub(r'\s+', ' ', w).strip().lower()
    return w


def merge(full_rows, unit_rows, ranges, assign):
    """full_rows: [(page, word, gloss)]；unit_rows: [(unit, word, gloss)]。

    ranges 是 [(起, 止)] 课本页码范围，assign(page, ranges) -> unit。
    返回 [(unit, word, gloss)]。
    """
    u2 = {}
    for u, w, g in unit_rows:
        u2.setdefault(norm(w), (u, g))
    out, have = [], set()
    for page, w, g in full_rows:
        k = norm(w)
        if k in u2:
            u, g2 = u2[k]
            out.append([u, w, g or g2])
        else:
            out.append([assign(page, ranges), w, g])
        have.add(k)
    for u, w, g in unit_rows:
        k = norm(w)
        if k not in have:
            out.append([u, w, g])
            have.add(k)
    return out
