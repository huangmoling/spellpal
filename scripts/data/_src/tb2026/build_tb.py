# -*- coding: utf-8 -*-
"""2026 秋新教材词表汇总构建器。

三类版式：
  blocks —— 单元块 + 词条（外研/沪教/湘少/译林/教科）
  two    —— Word List (1) 释义 + Word List (2) 字母索引页码（北京版）
  rj     —— 人教版「词形 /音标/ 释义 p.页码」字母序

输出：scripts/data/_src/tb2026/<key>.words.json
"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_blocks import (pages, parse_blocks, dedupe, norm_key, split_entry,
                          strip_page_ref)
import parse_bj

OUT = os.path.dirname(os.path.abspath(__file__))

UNIT_RE_FLEX = r'^(?:Unit\s*|U)(\d+)\s*$'

CONFIG = {
    # ---- 外研版（三起）----
    'wy-三a': dict(kind='blocks', span=(92, 94), idx=(95, 97)),
    'wy-四a': dict(kind='blocks', span=(88, 91), idx=(92, 96)),
    'wy-五a': dict(kind='blocks', span=(100, 101), idx=(102, 104)),
    # ---- 沪教牛津版 ----
    'hj-三a': dict(kind='blocks', span=(96, 97)),
    'hj-四a': dict(kind='blocks', span=(93, 94)),
    # ---- 湘少版 ----
    'xs-三a': dict(kind='blocks', span=(74, 76), idx=(77, 80)),
    'xs-四a': dict(kind='blocks', span=(76, 78), idx=(79, 82)),
    'xs-五a': dict(kind='blocks', span=(76, 78), idx=(79, 82)),
    'xs-六a': dict(kind='blocks', span=(76, 78), idx=(79, 82)),
    # ---- 译林版 ----
    'yl-五a': dict(kind='blocks', span=(110, 112), idx=(113, 115),
                    unit_re=r'^Unit\s{2,}(\d+)\s*$'),
    # ---- 教科版（单元号写成 Unit 1 / Unit3 / U6 混用）----
    'jk-三a': dict(kind='blocks', span=(82, 86), unit_re=UNIT_RE_FLEX),
    'jk-四a': dict(kind='blocks', span=(98, 101), unit_re=UNIT_RE_FLEX),
    'jk-六a': dict(kind='blocks', span=(98, 101), unit_re=UNIT_RE_FLEX),
    # ---- 北京版（两张表 join）----
    'bj-三a': dict(kind='two', l1=(86, 88), l2=(89, 90)),
    'bj-四a': dict(kind='two', l1=(106, 108), l2=(109, 110)),
    'bj-五a': dict(kind='two', l1=(107, 109), l2=(110, 111)),
}


def rng(t):
    return range(t[0], t[1] + 1)


def run_blocks(key, cfg):
    pg = pages(key)
    rows = parse_blocks(key, *cfg['span'], unit_re=cfg.get('unit_re', r'^Unit\s*(\d+)\s*$'))
    keep, dup = dedupe(rows)
    words = [dict(unit=u, word=w, gloss=g, star=st, page=pr) for u, w, g, st, pr in keep]
    check = dict(raw=len(rows), kept=len(keep), dup=[[d[0], d[1], d[2]] for d in dup])
    # 字母索引交叉校验
    if cfg.get('idx'):
        irows = parse_blocks(key, *cfg['idx'], unit_re=r'zzz^')
        ikeep, _ = dedupe(irows)
        a = {norm_key(w) for _, w, *_ in keep}
        b = {norm_key(w) for _, w, *_ in ikeep}
        check['index_count'] = len(ikeep)
        check['only_in_units'] = sorted(a - b)
        check['only_in_index'] = sorted(b - a)
    return words, check


def run_two(key, cfg):
    pg = pages(key)
    l2 = []
    for p in rng(cfg['l2']):
        l2 += parse_bj.parse_list2(pg[p])
    keys = {parse_bj.norm_key(w) for w, _ in l2}
    l1 = []
    for p in rng(cfg['l1']):
        l1 += parse_bj.parse_list1(pg[p], keys)
    d1 = {}
    for w, g in l1:
        d1.setdefault(parse_bj.norm_key(w), (w, g))
    words, missing = [], []
    for w, n in l2:
        k = parse_bj.norm_key(w)
        hw, gl = d1.get(k, (w, ''))
        if not gl:
            missing.append(w)
        words.append(dict(lesson=n, word=hw, gloss=gl))
    check = dict(list1=len(l1), index=len(l2),
                 only_in_list1=[w for w, _ in l1 if parse_bj.norm_key(w) not in
                                {parse_bj.norm_key(x) for x, _ in l2}],
                 missing_gloss=missing)
    return words, check


def main(keys):
    for key in keys:
        cfg = CONFIG[key]
        if cfg['kind'] == 'blocks':
            words, check = run_blocks(key, cfg)
        elif cfg['kind'] == 'two':
            words, check = run_two(key, cfg)
        else:
            raise SystemExit('未实现: ' + cfg['kind'])
        doc = dict(book=key, kind=cfg['kind'], config=cfg, check=check, words=words)
        path = os.path.join(OUT, key + '.words.json')
        json.dump(doc, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        units = {}
        for w in words:
            units[w.get('unit', w.get('lesson'))] = units.get(w.get('unit', w.get('lesson')), 0) + 1
        extra = ''
        if 'only_in_index' in check:
            extra = f" idx={check['index_count']} 差{len(check['only_in_units'])}+{len(check['only_in_index'])}"
        if 'missing_gloss' in check:
            extra = f" 缺释义{len(check['missing_gloss'])}"
        print(f'{key:8s} {len(words):4d} 条 {dict(sorted(units.items()))}{extra}')


if __name__ == '__main__':
    ks = sys.argv[1:] or list(CONFIG)
    main(ks)
