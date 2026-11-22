# -*- coding: utf-8 -*-
"""2026 秋下册 65 册：自动定位词汇表页 → 解析 → 数字校验。

每册配置只需给「出版社代号 + 词汇表起页」，起页由 auto_start 自动探测。
"""
import os, re, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_common import pages, parse_blocks, dedupe, norm_key, split_entry, CJK

OUT = os.path.dirname(os.path.abspath(__file__))
MARK = re.compile(r'(Word\s*lists?|Words\s+and\s+expressions|Vocabulary|VOCABULARY|Glossary|'
                  r'词汇表|单词表|生词表|My\s+Vocabulary\s+Bank)', re.I)
INDEX_HEAD = re.compile(r'^(II|Ⅱ|\(Ⅱ\)|（Ⅱ）)$')


def auto_start(key, last_frac=0.55):
    pg = pages(key)
    ks = sorted(pg)
    n = max(ks)
    cand = [p for p in ks if p > n * last_frac and MARK.search(pg[p])]
    # 取最后一个命中（Vocabulary 常在最后）
    return cand[-1] if cand else None


def parse_until(key, p0, span=5, unit_re=r'^Unit\s*(\d+)', stop_index=True):
    """从 p0 起解析，遇到字母索引标题（II / 单字母）即停。"""
    pg = pages(key)
    by = {}
    rows = []
    seen_letters = 0
    for p in range(p0, p0 + span):
        if p not in pg:
            break
        body = pg[p]
        if stop_index:
            cuts = [m.start() for m in re.finditer(r'(?m)^\s*(II|Ⅱ)\s*$', body)]
            cuts += [m.start() for m in re.finditer(r'本表按字母顺序|按字母顺序收录', body)]
            if cuts:
                body = body[:min(cuts)]
                by[p] = body
                break
        by[p] = body
    # 临时写回 pages 结构供 parse_blocks 使用
    import parse_common as pc
    old = pc.pages
    pc.pages = lambda k: by if k == key else old(k)
    try:
        rows = parse_blocks(key, p0, p0 + span - 1, unit_re=unit_re)
    finally:
        pc.pages = old
    return rows


def run(key, p0, span=4, unit_re=r'^\s*[UJ]nit\s*(\d+)'):
    rows = parse_until(key, p0, span, unit_re)
    keep, dup = dedupe(rows)
    units = {}
    for u, w, g, st, pr in keep:
        units.setdefault(u, []).append(w)
    return keep, dup, units


if __name__ == '__main__':
    for key in sys.argv[1:]:
        p0 = auto_start(key)
        if p0 is None:
            print(f'{key:8s} 未找到词汇表页'); continue
        span = 3 if key.startswith('yl-') else 4
        keep, dup, units = run(key, p0, span)
        print(f'{key:8s} p0={p0:3d}  {len(keep):4d} 条  dup={len(dup):2d}  单元={sorted(units)}  '
              f'每单元={[len(units[u]) for u in sorted(units)]}')
