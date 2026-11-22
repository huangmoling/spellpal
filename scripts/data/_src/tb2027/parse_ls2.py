# -*- coding: utf-8 -*-
"""辽师大版：按左右半页分别取词，避免双栏混行。"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_rows import path_of
import pymupdf

CJK = re.compile(r'[\u4e00-\u9fff]')
U_TAIL = re.compile(r'\bU\s*(\d+)\b')


def half_rows(key, pno, tol=3):
    doc = pymupdf.open(path_of(key))
    page = doc[pno - 1]
    W, H = page.rect.width, page.rect.height
    out = []
    for x0c, x1c in ((0, W / 2), (W / 2, W)):
        ws = page.get_text('words', clip=pymupdf.Rect(x0c, 0, x1c, H))
        ws.sort(key=lambda w: (round(w[1] / tol), w[0]))
        cur, cy = [], None
        for x0, y0, x1, y1, t, b, l, n in ws:
            if cy is None or abs(y0 - cy) <= tol:
                cur.append((x0, t)); cy = y0 if cy is None else cy
            else:
                out.append(cur); cur = [(x0, t)]; cy = y0
        if cur:
            out.append(cur)
    doc.close()
    return out


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


def split_line(toks):
    """一行 → (英文, 中文, 单元号)。英文可能在前也可能在后。"""
    eng, cn, unit = [], [], None
    for _, t in toks:
        m = re.fullmatch(r'U\s*(\d+)', t)
        if m:
            unit = int(m.group(1)); continue
        m2 = re.search(r'^(.*?)U\s*(\d+)$', t)
        if m2 and CJK.search(m2.group(1)):
            cn.append(m2.group(1)); unit = int(m2.group(2)); continue
        if CJK.search(t):
            cn.append(t)
        elif re.fullmatch(r"[A-Za-z][A-Za-z'’\-/().,=& ]*", t):
            eng.append(t)
    return collapse(' '.join(eng)).strip(), ''.join(cn).strip(), unit


def parse(key, p_from, p_to):
    rows = []
    for p in range(p_from, p_to + 1):
        for toks in half_rows(key, p):
            e, c, u = split_line(toks)
            if not e or not c or u is None:
                continue
            if re.fullmatch(r'[A-Z][a-z]?', e):      # 字母分节标题
                continue
            rows.append([u, e, c])
    return rows


if __name__ == '__main__':
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    rows = parse(key, a, b)
    from collections import Counter
    print(f'{key}: {len(rows)} 条 单元 {dict(sorted(Counter(u for u,_,_ in rows).items()))}')
    for r in rows[:10]:
        print('  ', r)
