# -*- coding: utf-8 -*-
"""北师大版 Word Bank 解析（扫描件 OCR 后）。

版面：整页两栏，左栏一个单元、右栏另一个单元，两栏顶部各有 `Unit N` 标题；
栏内每行是「词（x 小） 释义（x 大）」，释义折行时只有中文、没有词形。

分栏阈值按 x=700（A4 双栏，左栏 x<650，右栏 x>800）。
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CJK = re.compile(r'[\u4e00-\u9fff]')
UNIT = re.compile(r'^Unit\s*(\d{1,2})\b', re.I)
LESSON = re.compile(r'^Lesson\s*\d', re.I)
SPLIT = 700


def parse_pages(rows_by_page):
    """跨页跨栏共用一个单元计数器：词表是「左栏读到底再读右栏」的连续流。"""
    out = []
    unit = 0
    for pno in sorted(rows_by_page, key=lambda x: int(x)):
        rows = rows_by_page[pno]
        for side in (0, 1):
            for row in rows:
                cells = [(x, t) for x, t in row if (x < SPLIT) == (side == 0)]
                if not cells:
                    continue
                cells.sort()
                head = ' '.join(t for x, t in cells if not CJK.search(t)).strip()
                gloss = ''.join(t for x, t in cells if CJK.search(t)).strip()
                if not head and not gloss:
                    continue
                m = UNIT.match(head)
                if m:
                    unit = int(m.group(1))
                    continue
                if (LESSON.match(head) or head.lower().startswith('word bank')
                        or re.fullmatch(r'[\d*.“”＊]+', head)
                        or re.search(r'注：|课标|词汇表', gloss)):
                    continue
                if not head:
                    if out:
                        out[-1][2] += gloss
                    continue
                out.append([unit, head, gloss])
    return out


def load(key, pages=None):
    p = os.path.join(HERE, '..', '..', '..', '..', '.tmp', 'tb2ocr', key + '.wb.json')
    d = json.load(open(os.path.abspath(p), encoding='utf-8'))
    if pages:
        d = {k: v for k, v in d.items() if int(k) in pages}
    return d


if __name__ == '__main__':
    import sys
    from collections import Counter
    key = sys.argv[1]
    rows = parse_pages(load(key))
    print('条数', len(rows), sorted(Counter(r[0] for r in rows).items()))
    for u, w, g in rows:
        print('U%-2d %-24s %s' % (u, w, g))
