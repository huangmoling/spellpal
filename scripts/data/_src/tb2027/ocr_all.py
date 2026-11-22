# -*- coding: utf-8 -*-
"""扫描件 OCR：把没有文字层的 PDF 逐页渲染后识别，按坐标还原成行。

输出 .tmp/tb2ocr/{key}.txt，页间用 \\f 分隔，行内单元格用 \\t 分隔。
支持断点续跑：每页结果即时追加到 {key}.jsonl，重跑时已完成的页直接复用。
"""
import json
import os
import re
import sys
import time

import pymupdf
from rapidocr_onnxruntime import RapidOCR

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, '.tmp', 'tb2ocr')
SRC = r'F:/桌面/教材'

PUBS = {'翼教版': 'jj', '北京版': 'bj', '北师大版': 'bsd', '川教版': 'cj', '沪教版': 'hj',
        '教科版': 'jk', '辽师大版': 'ls', '清华版': 'qh', '湘少版': 'xs', '译林版': 'yl'}


def pdf_of(key):
    pub_key, gt = key.split('-')
    target = [k for k, v in PUBS.items() if v == pub_key][0]
    g, t = int(gt[0]), gt[1]
    d = os.path.join(SRC, target)
    for f in os.listdir(d):
        if not f.lower().endswith('.pdf'):
            continue
        f2 = re.sub(r'[\u200b-\u200f\ufeff\u00ad]', '', f)
        m = re.search(r'([一二三四五六])年级', f2)
        if not m:
            continue
        gg = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6}[m.group(1)]
        tt = 'a' if ('上册' in f2 or '秋' in f2) else ('b' if ('下册' in f2 or '春' in f2) else None)
        if gg == g and tt == t:
            return os.path.join(d, f)
    return None


def group_rows(boxes, ytol=10):
    """OCR 框 → 行。每个框是 (x0,y0,x1,y1,text)。行内按 x 排序，用 \\t 连。"""
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur, cy = [], [], None
    for b in boxes:
        mid = (b[1] + b[3]) / 2
        if cy is None or abs(mid - cy) <= ytol:
            cur.append(b)
            cy = mid if cy is None else (cy + mid) / 2
        else:
            rows.append(cur)
            cur, cy = [b], mid
    if cur:
        rows.append(cur)
    lines = []
    for r in rows:
        r.sort(key=lambda b: b[0])
        lines.append('\t'.join(x[4].strip() for x in r if x[4].strip()))
    return '\n'.join(lines)


def run(key, ocr):
    pdf = pdf_of(key)
    if not pdf:
        print('!! 找不到 PDF', key, flush=True)
        return
    jl = os.path.join(OUT, key + '.jsonl')
    got = {}
    if os.path.exists(jl):
        for ln in open(jl, encoding='utf-8'):
            try:
                o = json.loads(ln)
                got[o['p']] = o['t']
            except Exception:
                pass
    d = pymupdf.open(pdf)
    npage = d.page_count
    img = os.path.join(OUT, '_tmp_%s.png' % key)
    t0 = time.time()
    new = 0
    with open(jl, 'a', encoding='utf-8') as fh:
        for pno in range(npage):
            if pno in got:
                continue
            pix = d[pno].get_pixmap(dpi=200)
            pix.save(img)
            res, _ = ocr(img)
            boxes = [(b[0][0][0], b[0][0][1], b[0][2][0], b[0][2][1], b[1]) for b in (res or [])]
            txt = group_rows(boxes) if boxes else ''
            got[pno] = txt
            fh.write(json.dumps({'p': pno, 't': txt}, ensure_ascii=False) + '\n')
            fh.flush()
            new += 1
            if new % 10 == 0:
                print('  %s %d/%d %.0fs' % (key, pno + 1, npage, time.time() - t0), flush=True)
    d.close()
    if os.path.exists(img):
        os.remove(img)
    pages = [got.get(i, '') for i in range(npage)]
    with open(os.path.join(OUT, key + '.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\f'.join(pages))
    print('== %s 完成 %d 页，新识别 %d' % (key, len(pages), new), flush=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    keys = sys.argv[1:]
    engine = RapidOCR(intra_op_num_threads=2)
    for k in keys:
        run(k, engine)
