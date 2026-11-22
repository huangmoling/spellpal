# -*- coding: utf-8 -*-
"""北京版四下 Word List (1)：词与释义分列，栏内夹着 `Unit One` 标题与橙色课次号。

这册的 Unit Four 标题没印出来（课次 11、12 直接接在 Unit Five 之前），
只能按课次号补：11、12 归 Unit 4。
"""
import json
import os
import re

CJK = re.compile(r'[\u4e00-\u9fff]')
NUMWORD = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
           'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10}
UNIT = re.compile(r'^Unit\s*([A-Za-z]+)$', re.I)
SPLIT = 700

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
OUT = os.path.join(ROOT, '.tmp', 'tb2ocr')


def parse(key, pages):
    data = json.load(open(os.path.join(OUT, key + '.wb.json'), encoding='utf-8'))
    out = []
    unit = 0
    for p in pages:
        rows = data.get(str(p)) or []
        for side in (0, 1):
            for row in rows:
                cells = [c for c in row if (c[0] < SPLIT) == (side == 0)]
                if not cells:
                    continue
                cells.sort(key=lambda c: c[0])
                texts = [c[1].strip() for c in cells if c[1].strip()]
                if not texts:
                    continue
                joined = ' '.join(texts)
                m = UNIT.match(texts[0].replace(' ', '') if len(texts) == 1 else '')
                if m:
                    g = m.group(1).lower()
                    if g in NUMWORD:
                        unit = NUMWORD[g]
                        continue
                if len(texts) == 1 and re.fullmatch(r'\d{1,2}', texts[0]):
                    continue              # 课次分组编号，单元只认 Unit 标题（本册没有 Unit Four）
                if 'Word List' in joined or '加粗词汇' in joined or '义务教育' in joined:
                    continue
                if CJK.search(texts[0]) and not CJK.search(joined.replace(texts[0], '')):
                    # 整行只有释义 → 接到上一条
                    if out:
                        out[-1][2] += texts[0]
                    continue
                # 词形 = 第一个不含汉字的格子；其余是释义
                head = ''
                gloss = ''
                for t in texts:
                    if not head and not CJK.search(t):
                        head = t
                    elif CJK.search(t):
                        gloss += t
                head = re.sub(r'\s*[*＊]\s*', ' ', head).strip()
                if not head:
                    continue
                out.append([unit, head, gloss])
    seen, keep = set(), []
    for u, w, g in out:
        k = w.lower()
        if k in seen:
            continue
        seen.add(k)
        keep.append([u, w, g])
    return keep


if __name__ == '__main__':
    import sys
    from collections import Counter
    key = sys.argv[1]
    ps = [int(x) for x in sys.argv[2].split(',')]
    rows = parse(key, ps)
    print('条数', len(rows), sorted(Counter(r[0] for r in rows).items()))
    for u, w, g in rows:
        print('U%-2d %-26s %s' % (u, w, g))
