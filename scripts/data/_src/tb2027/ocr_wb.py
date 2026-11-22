# -*- coding: utf-8 -*-
"""只对词表页重新识别，保留每个格子的 x 坐标 —— 双栏词表必须靠 x 分栏。

ocr_all.py 出于文本检索的需要把行压成字符串，丢了坐标；词表解析需要知道
「这一格在左栏还是右栏」，所以单独跑这一遍。每册只跑几页，代价很小。

输出 .tmp/tb2ocr/{key}.wb.json：{页码: [[[x0, 文本], ...], ...]}
"""
import json
import os
import sys

import pymupdf
from rapidocr_onnxruntime import RapidOCR

from ocr_all import OUT, pdf_of


def run(key, pages, ocr):
    path = os.path.join(OUT, key + '.wb.json')
    old = {}
    if os.path.exists(path):
        try:
            old = json.load(open(path, encoding='utf-8'))
        except Exception:
            old = {}      # 上次中断留下的空文件，重跑即可
    doc = pymupdf.open(pdf_of(key))
    img = os.path.join(OUT, '_wb_%s.png' % key)
    for pno in pages:
        if str(pno) in old:
            continue
        if pno < 1 or pno > doc.page_count:
            print('  %s P%d 超出页数(%d)，跳过' % (key, pno, doc.page_count), flush=True)
            continue
        pix = doc[pno - 1].get_pixmap(dpi=220)
        pix.save(img)
        res, _ = ocr(img)
        boxes = [(b[0][0][0], b[0][0][1], b[0][2][0], b[0][2][1], b[1])
                 for b in (res or [])]
        boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
        rows, cur, cy = [], [], None
        for b in boxes:
            mid = (b[1] + b[3]) / 2
            if cy is None or abs(mid - cy) <= 10:
                cur.append(b)
                cy = mid if cy is None else (cy + mid) / 2
            else:
                rows.append(cur)
                cur, cy = [b], mid
        if cur:
            rows.append(cur)
        out = []
        for r in rows:
            r.sort(key=lambda b: b[0])
            out.append([[round(b[0]), b[4].strip()] for b in r if b[4].strip()])
        old[str(pno)] = out
        print('  %s P%d %d 行' % (key, pno, len(out)), flush=True)
    doc.close()
    if os.path.exists(img):
        os.remove(img)
    json.dump(old, open(path, 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    key = sys.argv[1]
    pages = [int(x) for x in sys.argv[2].split(',')]
    run(key, pages, RapidOCR(intra_op_num_threads=2))
