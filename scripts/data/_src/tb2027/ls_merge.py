# -*- coding: utf-8 -*-
"""辽师大：字母序总表（词形+音标+释义，完整） + 分单元表（词→单元）合并。"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_ls3 import parse as unit_table, halves
from parse_ls2 import parse as alpha_full
from parse_ls3 import collapse
from pdf_rows import path_of

CJK = re.compile(r'[\u4e00-\u9fff]')
IPA = re.compile(r'/[^/]{1,25}/')


def norm(w):
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)
    return re.sub(r'\s+', ' ', w).strip().lower()


def alpha_list(key, p_from, p_to):
    rows = alpha_full(key, p_from, p_to)
    if rows:
        return rows
    # 没有 U 标记的书：从半页行里取「英文 | 音标 | 释义」
    out = []
    for p in range(p_from, p_to + 1):
        for rs in halves(key, p):
            for toks in rs:
                eng, rest, hit = [], [], False
                for t in toks:
                    if CJK.search(t) or IPA.fullmatch(t):
                        hit = True
                    (rest if hit else eng).append(t)
                e = collapse(' '.join(eng)).strip()
                c = ' '.join(rest).strip()
                e = re.sub(r'\s+', ' ', e)
                if e and c and re.fullmatch(r"[A-Za-z][A-Za-z'’\-/().,= ]*", e):
                    out.append([0, e, c])
    return out


def parse(key, ua, ub, aa, ab):
    umap = {}
    for u, w, g in unit_table(key, ua, ub):
        umap.setdefault(norm(w), u)
    rows = alpha_list(key, aa, ab)
    out, miss = [], []
    seen = set()
    for u, w, g in rows:
        k = norm(w)
        if not k or k in seen:
            continue
        seen.add(k)
        g2 = IPA.sub('', g).replace('（', '(').replace('）', ')')
        g2 = re.sub(r'\s+', ' ', g2).strip()
        unit = u or umap.get(k, 0)
        if not unit:
            miss.append(w)
        out.append([unit, w, g2])
    return out, miss


if __name__ == '__main__':
    key = sys.argv[1]
    ua, ub, aa, ab = (int(x) for x in sys.argv[2:6])
    rows, miss = parse(key, ua, ub, aa, ab)
    from collections import Counter
    print(f'{key}: {len(rows)} 条 单元 {dict(sorted(Counter(u for u,_,_ in rows).items()))} 未归属 {len(miss)}')
    print('  未归属:', miss[:10])
