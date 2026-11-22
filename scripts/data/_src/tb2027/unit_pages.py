# -*- coding: utf-8 -*-
"""按字号找每页的单元标题，给出「单元 → 起始文件页」。

课文首页的 `Unit N` 是页面最大的字，但文字层常常被拆成 `Unit` + `1` 两个 span，
所以先把该页所有 size>=16 的 span 拼起来再匹配。扫描件没有文字层，此函数返回空，
调用方需要改用 OCR 文本。
"""
import re

import pymupdf

from pdf_rows import path_of


def unit_title_pages(key, min_size=16):
    doc = pymupdf.open(path_of(key))
    out = []
    for i, page in enumerate(doc):
        info = page.get_text('dict')
        big = []
        for b in info['blocks']:
            for ln in b.get('lines', []):
                for s in ln['spans']:
                    if s['size'] >= min_size and s['text'].strip():
                        big.append((s['bbox'][1], s['bbox'][0], s['text'].strip()))
        if not big:
            continue
        big.sort()
        txt = ' '.join(t for _, _, t in big)
        m = re.search(r'Unit\s*(\d{1,2})\b', txt)
        if m:
            out.append((int(m.group(1)), i + 1))
    doc.close()
    seen, res = set(), []
    for u, p in out:
        if u in seen:
            continue
        seen.add(u)
        res.append((u, p))
    return res


if __name__ == '__main__':
    import sys
    for k in sys.argv[1:]:
        print(k, unit_title_pages(k))
