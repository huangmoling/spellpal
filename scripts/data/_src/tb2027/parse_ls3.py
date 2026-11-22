# -*- coding: utf-8 -*-
"""辽师大版「Words and expressions」：左右半页分别按行读取，半页内跟踪 Unit 标题。"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_rows import path_of
import pymupdf

CJK = re.compile(r'[\u4e00-\u9fff]')
UNIT = re.compile(r'Unit\s*(\d+)')


def collapse(s):
    toks = s.split()
    n = len(toks)
    if n >= 2 and n % 2 == 0 and toks[:n // 2] == toks[n // 2:]:
        toks = toks[:n // 2]
    o = []
    for t in toks:
        if not o or o[-1] != t:
            o.append(t)
    return ' '.join(o)


def halves(key, pno, tol=3):
    doc = pymupdf.open(path_of(key))
    page = doc[pno - 1]
    W, H = page.rect.width, page.rect.height
    res = []
    for x0c, x1c in ((0, W / 2), (W / 2, W)):
        ws = page.get_text('words', clip=pymupdf.Rect(x0c, 0, x1c, H))
        ws.sort(key=lambda w: (round(w[1] / tol), w[0]))
        rows, cur, cy = [], [], None
        for x0, y0, x1, y1, t, b, l, n in ws:
            if cy is None or abs(y0 - cy) <= tol:
                cur.append(t); cy = y0 if cy is None else cy
            else:
                rows.append(cur); cur = [t]; cy = y0
        if cur:
            rows.append(cur)
        res.append(rows)
    doc.close()
    return res


def parse(key, p_from, p_to):
    out = []
    cur = 0
    for p in range(p_from, p_to + 1):
        for rows in halves(key, p):
            for toks in rows:
                line = ' '.join(toks)
                m = UNIT.search(line)
                if m and len(toks) <= 6:          # 单元标题行
                    cur = int(m.group(1))
                    continue
                eng, cn, hit = [], [], False
                for t in toks:
                    if CJK.search(t):
                        hit = True
                    (cn if hit else eng).append(t)
                e = collapse(' '.join(eng)).strip()
                c = ''.join(cn).strip()
                if not e or not c:
                    continue
                if not re.fullmatch(r"[A-Za-z(][A-Za-z'’\-/().,= ]*", e):
                    continue
                if e.lower() in ('words and expressions', 'unit'):
                    continue
                out.append([cur, e, c])
    return out


if __name__ == '__main__':
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    rows = parse(key, a, b)
    from collections import Counter
    print(f'{key}: {len(rows)} 条 单元 {dict(sorted(Counter(u for u,_,_ in rows).items()))}')
    for r in rows[:8]:
        print('  ', r)
