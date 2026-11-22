# -*- coding: utf-8 -*-
"""2026 秋「下册」词表构建：按册显式配置 mode + 词汇表页区间。

mode:
  yl/hj/xs/jk  blocks  —— 「Unit N」分块（遇字母索引页停）
  cj           tabs    —— 词形 TAB + 换行释义，遇 Vocabulary 页停
  jj/qh        alpha   —— 字母序 + 课本页码，页码→单元用目录换算
  bj           bjlist  —— Word List(1) 取释义 + Word List(2) 取课次
  ls           lsalpha —— 双栏字母序，行尾带 U 编号
"""
import os, re, sys, json, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build2027 as B
from parse_common import pages, dedupe, norm_key, CJK, parse_blocks
from parse_alpha import parse as alpha_parse
from parse_ls2 import parse as ls_parse
import parse_bj as PB

HERE = os.path.dirname(os.path.abspath(__file__))

# 每册：mode, 页码范围（词汇表起页, 末页）
CONF = {
    'yl-3b': ('blocks', 79, 81), 'yl-5b': ('blocks', 96, 98), 'yl-6b': ('blocks', 96, 98),
    'hj-3b': ('blocks', 94, 96), 'hj-5b': ('blocks', 96, 98), 'hj-6a': ('blocks', 98, 100),
    'hj-6b': ('blocks', 90, 92),
    'xs-3b': ('blocks', 74, 76),
    'jk-4b': ('blocks', 93, 95), 'jk-5b': ('blocks', 83, 85), 'jk-6b': ('blocks', 70, 72),
    'cj-3a': ('tabs', 88, 94), 'cj-3b': ('tabs', 90, 98), 'cj-4a': ('tabs', 92, 96),
    'cj-4b': ('tabs', 74, 77), 'cj-5b': ('tabs', 84, 87), 'cj-6b': ('tabs', 84, 86),
    'jj-3a': ('alpha', 83, 88), 'jj-3b': ('alpha', 83, 88), 'jj-4a': ('alpha', 84, 89),
    'jj-5a': ('alpha', 81, 84), 'jj-5b': ('alpha', 80, 85),
    'jj-6a': ('alpha', 81, 84), 'jj-6b': ('alpha', 81, 84),
    'qh-3a': ('alpha', 95, 97), 'qh-3b': ('alpha', 95, 97), 'qh-4b': ('alpha', 80, 81),
    'qh-5a': ('alpha', 80, 81), 'qh-5b': ('alpha', 80, 81), 'qh-6b': ('alpha', 80, 81),
    'bj-2b': ('bjlist', 74, 76), 'bj-3b': ('bjlist', 86, 89), 'bj-5b': ('bjlist', 89, 91),
    'bj-6a': ('bjlist', 92, 94), 'bj-6b': ('bjlist', 66, 68),
    'ls-3a': ('lsalpha', 96, 97), 'ls-3b': ('lsalpha', 95, 96), 'ls-4a': ('lsalpha', 96, 97),
    'ls-4b': ('lsmerge', 81, 83, 86, 88), 'ls-5a': ('lsmerge', 82, 84, 85, 88),
    'ls-5b': ('lsmerge', 81, 83, 85, 87), 'ls-6a': ('lsmerge', 81, 83, 85, 88),
    'ls-6b': ('lsmerge', 78, 79, 80, 84),
}


def blocks(key, a, b, unit_re=r'^\s*\d*\s*[UJ]nit\s*(\d+)'):
    pg = pages(key)
    by = {}
    for p in range(a, b + 1):
        if p not in pg:
            break
        body = pg[p]
        cuts = [m.start() for m in re.finditer(r'(?m)^\s*(II|Ⅱ)\s*$', body)]
        cuts += [m.start() for m in re.finditer(r'本表按字母顺序|按字母顺序收录', body)]
        if cuts:
            by[p] = body[:min(cuts)]
            break
        by[p] = body
    import parse_common as pc
    old = pc.pages
    pc.pages = lambda k: by if k == key else old(k)
    try:
        rows = parse_blocks(key, a, b, unit_re=unit_re)
    finally:
        pc.pages = old
    return rows


def tabs(key, a, b):
    pg = pages(key)
    cur = 0
    out = []
    for p in range(a, b + 1):
        lines = pg.get(p, '').split('\n')
        i = 0
        while i < len(lines):
            raw = lines[i]
            s = raw.strip()
            if not s:
                i += 1
                continue
            m = re.match(r'^\s*(?:Module\s*[A-Z0-9]+\s*)?Unit\s*(\d+)', s)
            if m:
                cur = int(m.group(1)); i += 1; continue
            if re.match(r'^(Module\s|Challenge Yourself|Vocabulary|Word List|My Vocabulary Bank)', s, re.I):
                i += 1; continue
            if raw.rstrip(' ').endswith('\t'):
                head = re.sub(r'^[*＊]\s*', '', raw.rstrip('\t ').strip())
                gloss = ''
                j = i + 1
                while j < len(lines) and lines[j].strip() and CJK.search(lines[j]):
                    gloss += lines[j].strip(); j += 1
                if head and gloss:
                    out.append([cur, head, gloss, False, None])
                i = j
                continue
            i += 1
    return out


def lesson_unit_map(key):
    """从目录页读 UNIT ONE... 与 Lesson N 的先后顺序，得到 课次→单元。"""
    pg = pages(key)
    txt = ''.join(pg.get(p, '') + '\n' for p in range(4, 14))
    marks = []
    for m in re.finditer(r'UNIT\s+([A-Za-z]+)', txt):
        marks.append((m.start(), 'u'))
    for m in re.finditer(r'Lesson\s*(\d{1,2})', txt):
        marks.append((m.start(), int(m.group(1))))
    marks.sort()
    umap, unit, seen = {}, 0, set()
    for pos, k in marks:
        if k == 'u':
            nxt = [x for x in marks if x[0] > pos and x[1] == 'u']
            pass
    unit = 0
    for pos, k in marks:
        if k == 'u':
            unit += 1
        elif isinstance(k, int) and k not in seen:
            seen.add(k)
            umap[k] = unit
    return umap


def bjlist(key, a, b):
    pg = pages(key)
    l2p = [p for p in range(a, b + 1) if re.search(r'WORD\s*LIST\s*[（(]\s*2', pg.get(p, ''), re.I)]
    if not l2p:
        return []
    l1p = [p for p in range(a, l2p[0])]
    l2 = []
    for p in l2p + [l2p[0] + 1]:
        l2 += PB.parse_list2(pg.get(p, ''))
    keys = {PB.norm_key(w) for w, _ in l2}
    l1 = []
    for p in l1p:
        l1 += PB.parse_list1(pg.get(p, ''), keys)
    d1 = {}
    for w, g in l1:
        d1.setdefault(PB.norm_key(w), (w, g))
    um = lesson_unit_map(key)
    out = []
    for w, n in l2:
        hw, gl = d1.get(PB.norm_key(w), (w, ''))
        out.append([um.get(n, 0), hw, gl, False, None])
    return out


def unit_ranges_paren(key):
    txt = ''.join(pages(key).get(p, '') + '\n' for p in range(4, 9))
    return [(int(m.group(1)), int(m.group(2))) for m in re.finditer(r'\(P\s*(\d+)\s*[-–~]\s*(\d+)\)', txt)]


def unit_starts_dots(key):
    txt = ''.join(pages(key).get(p, '') + '\n' for p in range(4, 9))
    return [int(m.group(1)) for m in re.finditer(r'[.·]{3,}\s*(\d{1,3})', txt)]


def dash_ranges(key):
    r = B.unit_ranges_from_dash(key, range(4, 8))
    out = []
    for a, b in r:
        if not out:
            if a == 1:
                out.append((a, b))
        elif a == out[-1][1] + 1:
            out.append((a, b))
        else:
            break
    return out


def alpha(key, a, b):
    rows = alpha_parse(key, a, b)
    n = max(pages(key))
    ups = unit_starts_dots(key)
    pr = unit_ranges_paren(key)
    cands = []
    if len(pr) >= 3:
        cands.append(pr)
    d = dash_ranges(key)
    if len(d) >= 4:
        cands.append(d)
    if len(ups) >= 3:
        cands.append([(ups[i], (ups[i + 1] - 1) if i + 1 < len(ups) else 999) for i in range(len(ups))])
    ranges = max(cands, key=lambda rs: sum(1 for r in rows if B.assign_unit(r['page'], rs))) if cands else []
    return [[B.assign_unit(r['page'], ranges), r['word'], r['gloss'], False, r['page']] for r in rows]


def run(key):
    if key not in CONF:
        return [], '?'
    conf = CONF[key]
    mode, a, b = conf[0], conf[1], conf[2]
    if mode == 'blocks':
        keep, _ = dedupe(blocks(key, a, b, unit_re=r'^\s*(?:Unit|U)\s*(\d+)'))
        return keep, mode
    if mode == 'tabs':
        return tabs(key, a, b), mode
    if mode == 'alpha':
        return alpha(key, a, b), mode
    if mode == 'bjlist':
        return bjlist(key, a, b), mode
    if mode == 'lsmerge':
        import ls_merge
        rows, _miss = ls_merge.parse(key, conf[1], conf[2], conf[3], conf[4])
        return [[u, w, g, False, None] for u, w, g in rows], mode
    if mode == 'lsalpha':
        return [[u, w, g, False, None] for u, w, g in ls_parse(key, a, b)], mode
    return [], mode


if __name__ == '__main__':
    keys = sys.argv[1:] or sorted(CONF)
    summary = []
    for key in keys:
        rows, mode = run(key)
        units = {}
        for r in rows:
            units[r[0]] = units.get(r[0], 0) + 1
        print(f'{key:8s} {mode:8s} {len(rows):4d} 条  ' +
              ' '.join(f'U{u}:{units[u]}' for u in sorted(units)))
        summary.append(dict(book=key, mode=mode, n=len(rows), units=units))
        json.dump(dict(book=key, mode=mode,
                       words=[dict(unit=r[0], word=r[1], gloss=r[2], star=r[3], page=r[4]) for r in rows]),
                  open(os.path.join(HERE, key + '.words.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
    json.dump(summary, open(os.path.join(HERE, '_summary.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
