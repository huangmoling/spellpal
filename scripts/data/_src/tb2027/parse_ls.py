# -*- coding: utf-8 -*-
"""辽师大版：双栏「英文 | 中文」，用 x 坐标切左右两栏，并按「所属栏」跟踪单元标题。"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_rows import rows_xy, path_of
import pymupdf

CJK = re.compile(r'[\u4e00-\u9fff]')
UNIT = re.compile(r'\bUnit\s*(\d+)\b')


def collapse_dup(s):
    """'my my' → 'my'；'Mr ( (AmE AmE Mr. Mr.) )' → 'Mr (AmE Mr.)'"""
    toks = s.split()
    n = len(toks)
    if n >= 2 and n % 2 == 0 and toks[:n // 2] == toks[n // 2:]:
        toks = toks[:n // 2]
    out = []
    for t in toks:
        if not out or out[-1] != t:
            out.append(t)
    return ' '.join(out)


def page_rows(key, pno):
    doc = pymupdf.open(path_of(key))
    mid = doc[pno - 1].rect.width / 2
    doc.close()
    out = []
    for r in rows_xy(key, pno):
        cols = {0: [], 1: []}
        for x0, x1, t in r:
            cols[0 if x0 < mid else 1].append(t)
        cells = []
        for k in (0, 1):
            eng, cn, hit = [], [], False
            for t in cols[k]:
                if CJK.search(t):
                    hit = True
                (cn if hit else eng).append(t)
            cells.append((' '.join(eng), ' '.join(cn)))
        out.append(cells)
    return out


def parse(key, p_from, p_to):
    cur = [0, 0]
    rows = []
    for p in range(p_from, p_to + 1):
        for cells in page_rows(key, p):
            header = ' '.join(e for e, c in cells)
            if re.search(r'\bUnit\b', header):
                for i, (e, c) in enumerate(cells):
                    m = UNIT.search(e) or UNIT.search(c)
                    if m:
                        cur[i] = int(m.group(1))
                continue
            for i, (e, c) in enumerate(cells):
                e = collapse_dup(e).strip()
                c = c.strip()
                if not e or not c:
                    continue
                if not re.fullmatch(r"[A-Za-z][A-Za-z'’\-/().,= ]*", e):
                    continue
                rows.append([cur[i], e, c])
    return rows


if __name__ == '__main__':
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    rows = parse(key, a, b)
    from collections import Counter
    c = Counter(u for u, _, _ in rows)
    print(f'{key}: {len(rows)} 条  单元 {dict(sorted(c.items()))}')
    for u, e, g in rows[:8]:
        print(f'  U{u} {e:24s} {g}')
