# -*- coding: utf-8 -*-
"""辽师大版书末 Word list：每格「单词 单词 释义 U4」，单元号直接带在行尾。"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_ls import page_rows, collapse_dup
from pdf_rows import path_of

CJK = re.compile(r'[\u4e00-\u9fff]')
UNIT_TAIL = re.compile(r'^(.*?)\s*\bU\s*(\d+)$', re.S)


def parse(key, p_from, p_to):
    rows = []
    for p in range(p_from, p_to + 1):
        for cells in page_rows(key, p):
            for e, c in cells:
                if not c:
                    continue
                m = UNIT_TAIL.match(c.strip())
                if not m:
                    continue
                gloss = m.group(1).strip()
                unit = int(m.group(2))
                head = collapse_dup(e).strip()
                if not head or not gloss:
                    continue
                head = re.sub(r'^(?:[A-Z][a-z]?)\s+', '', head)   # 去掉行首字母标题 'Aa'
                if not re.fullmatch(r"[A-Za-z][A-Za-z'’\-/().,= ]*", head):
                    continue
                rows.append([unit, head, gloss])
    return rows


if __name__ == '__main__':
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    rows = parse(key, a, b)
    from collections import Counter
    print(f'{key}: {len(rows)} 条 单元 {dict(sorted(Counter(u for u,_,_ in rows).items()))}')
    for r in rows[:10]:
        print('  ', r)
