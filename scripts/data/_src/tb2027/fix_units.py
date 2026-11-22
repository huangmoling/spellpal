# -*- coding: utf-8 -*-
"""用课文首现重算全部册次的单元归属，并与现有词表页解析结果对比。

课本页码 → 文件页的偏移，用「目录里词表页标注的页码」和「CONF 里词表页的实际文件页」之差求得。
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build2027 as B
import run2
import unit_by_text as U
from parse_common import pages

TOC_LABEL = re.compile(
    r'(Words?\s+in\s+Each\s+Unit|Word\s*list|Vocabulary|Words?\s+and\s+expressions)'
    r'[^\n]{0,20}?[.·…]{2,}\s*(\d{1,3})', re.I)


def offset_of(key, toc_pages=(4, 9), wl_page=None):
    pg = pages(key)
    txt = '\n'.join(pg.get(p, '') for p in range(toc_pages[0], toc_pages[1] + 1))
    m = TOC_LABEL.search(txt)
    if not m or wl_page is None:
        return None
    return wl_page - int(m.group(2))


def main(keys):
    for key in keys:
        conf = run2.CONF.get(key)
        if not conf:
            continue
        wl_page = conf[1]
        off = offset_of(key, wl_page=wl_page)
        rng = U.toc_ranges(key)
        if not off or not rng:
            print('%-8s 跳过 offset=%s ranges=%s' % (key, off, rng))
            continue
        p = os.path.join(run2.HERE, key + '.words.json')
        d = json.load(open(p, encoding='utf-8'))
        ws = d['words']
        names = [w['word'] for w in ws]
        body = range(7, wl_page)
        u, idx = U.assign_units(key, names, body, rng, off)
        diff = []
        for w in ws:
            nu = u.get(w['word'])
            if nu and nu != w['unit']:
                diff.append((w['word'], w['unit'], nu))
            if nu:
                w['unit'] = nu
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        from collections import Counter
        c = Counter(w['unit'] for w in ws)
        print('%-8s off=%-2d ranges=%s 单位分布=%s 改动=%d 未定位=%d'
              % (key, off, rng, sorted(c.items()), len(diff), sum(1 for w in ws if w['unit'] == 0)))
        for x in diff[:4]:
            print('     %-18s U%s → U%s' % x)


if __name__ == '__main__':
    main(sys.argv[1:] or sorted(run2.CONF))
