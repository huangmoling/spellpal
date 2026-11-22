# -*- coding: utf-8 -*-
"""按 y 坐标聚合 PDF 词级文本，输出「行 → 单元格」结构，用于双栏词表。"""
import os, re
import pymupdf

ROOT = r'F:/桌面/教材'
PUBS = {'翼教版': 'jj', '北京版': 'bj', '北师大版': 'bsd', '川教版': 'cj', '沪教版': 'hj',
        '教科版': 'jk', '辽师大版': 'ls', '清华版': 'qh', '湘少版': 'xs', '译林版': 'yl'}
G = {'一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6'}
_cache = {}


def path_of(key):
    if key in _cache:
        return _cache[key]
    ab, gt = key.split('-')
    pub = [k for k, v in PUBS.items() if v == ab][0]
    d = os.path.join(ROOT, pub)
    for f in sorted(os.listdir(d)):
        fn = re.sub(r'[\u200b-\u200f\ufeff\u00ad]', '', f)
        m = re.search(r'([一二三四五六])\s*年级', fn)
        if not m:
            continue
        if G[m.group(1)] + ('a' if '上册' in fn else 'b') == gt:
            _cache[key] = os.path.join(d, f)
            return _cache[key]
    raise SystemExit('找不到 PDF: ' + key)


def rows_of(key, pno, ytol=4, gap=90):
    """返回 [[(x, text), ...]]，每行是一个单元格列表（按 x 间距切分）。"""
    doc = pymupdf.open(path_of(key))
    page = doc[pno - 1]
    ws = sorted(page.get_text('words'), key=lambda w: (round(w[1] / ytol), w[0]))
    doc.close()
    out, cur, cy = [], [], None
    for x0, y0, x1, y1, t, b, l, n in ws:
        if cy is None or abs(y0 - cy) <= ytol:
            cur.append((x0, x1, t)); cy = y0 if cy is None else cy
        else:
            out.append(cur); cur = [(x0, x1, t)]; cy = y0
    if cur:
        out.append(cur)
    lines = []
    for r in out:
        cells, buf, lastx1 = [], [], None
        for x0, x1, t in r:
            if lastx1 is not None and x0 - lastx1 > gap:
                cells.append(' '.join(buf)); buf = []
            buf.append(t); lastx1 = x1
        if buf:
            cells.append(' '.join(buf))
        lines.append([(r[0][0], c) for c in cells] if False else cells)
    return lines


def rows_xy(key, pno, ytol=4):
    doc = pymupdf.open(path_of(key))
    page = doc[pno - 1]
    ws = page.get_text('words')
    doc.close()
    rows, cur, cy = [], [], None
    for x0, y0, x1, y1, t, b, l, n in sorted(ws, key=lambda w: (round(w[1] / ytol), w[0])):
        if cy is None or abs(y0 - cy) <= ytol:
            cur.append((x0, x1, t)); cy = y0 if cy is None else cy
        else:
            rows.append(cur); cur = [(x0, x1, t)]; cy = y0
    if cur:
        rows.append(cur)
    return rows


if __name__ == '__main__':
    import sys
    key, p = sys.argv[1], int(sys.argv[2])
    for r in rows_of(key, p):
        print(' ‖ '.join(r))
