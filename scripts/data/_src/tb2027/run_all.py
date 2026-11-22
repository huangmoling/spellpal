# -*- coding: utf-8 -*-
"""驱动：逐册选 mode、定位词表页、解析并落盘。"""
import os, re, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build2027 as B
from parse_common import pages, dedupe, norm_key, CJK, parse_blocks
from parse_alpha import parse as alpha_parse
from parse_ls import parse as ls_parse

HERE = os.path.dirname(os.path.abspath(__file__))
TXT = r'F:\项目\学英语\spellpal\.tmp\tb2text'
IDX_LINE = re.compile(r'^\s*[A-Z]\s*$')


def all_keys():
    return sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(TXT, '*.txt')))


def text_ok(key):
    pg = pages(key)
    return sum(len(v.strip()) for v in pg.values()) > 8000


def looks_index(body):
    lines = [l for l in body.split('\n') if l.strip()]
    letters = sum(1 for l in lines if IDX_LINE.match(l))
    return letters >= 2 or '本表按字母顺序' in body or re.search(r'[（(]\s*(Ⅱ|II)\s*[)）]', body)


def tail_candidates(key, pat, frac=0.55):
    pg = pages(key)
    n = max(pg)
    return [p for p in sorted(pg) if p > n * frac and re.search(pat, pg[p], re.I)]


def parse_block_pages(key, p0, maxp=6, unit_re=r'^\s*\d*\s*[UJ]nit\s*(\d+)'):
    """从 p0 起逐页解析，遇到字母索引页即停。"""
    pg = pages(key)
    by = {}
    for p in range(p0, p0 + maxp):
        if p not in pg:
            break
        body = pg[p]
        cuts = [m.start() for m in re.finditer(r'(?m)^\s*(II|Ⅱ)\s*$', body)]
        cuts += [m.start() for m in re.finditer(r'本表按字母顺序|按字母顺序收录', body)]
        if cuts:
            by[p] = body[:min(cuts)]
            break
        if p > p0 and looks_index(body):
            break
        by[p] = body
    import parse_common as pc
    old = pc.pages
    pc.pages = lambda k: by if k == key else old(k)
    try:
        rows = parse_blocks(key, p0, p0 + maxp - 1, unit_re=unit_re)
    finally:
        pc.pages = old
    return rows


def block_auto(key, maxp=6, unit_re=r'^\s*\d*\s*[UJ]nit\s*(\d+)'):
    pg = pages(key)
    n = max(pg)
    cand = [p for p in sorted(pg) if p > n * 0.55 and B.MARK.search(pg[p])]
    best = None
    for p0 in cand:
        rows = parse_block_pages(key, p0, maxp, unit_re)
        keep, _ = dedupe(rows)
        units = {u for u, *_ in keep}
        score = (len(units) >= 4, len(keep))
        if best is None or score > best[0]:
            best = (score, p0, keep)
    return best


def alpha_pages(key):
    pg = pages(key)
    n = max(pg)
    out = []
    for p in sorted(pg):
        if p <= n * 0.55:
            continue
        head = [l.strip() for l in pg[p].split('\n') if l.strip()][:5]
        if any(re.fullmatch(r'(Vocabulary|VOCABULARY|词汇表|WORD\s*LIST)', h) for h in head):
            out.append(p)
    return out


def unit_starts_dots(key, n_expect=None):
    txt = ''.join(pages(key).get(p, '') + '\n' for p in range(5, 9))
    return [int(m.group(1)) for m in re.finditer(r'[.·]{3,}\s*(\d{1,3})', txt)]


def dash_ranges(key):
    r = B.unit_ranges_from_dash(key, range(5, 8))
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


def run(key):
    if key.startswith('yl-'):
        best = block_auto(key, 4, unit_re=r'^\s*Unit\s+(\d+)')
        return best[2], 'yl', best[1]
    if key.startswith('hj-'):
        best = block_auto(key, 6)
        return best[2], 'hj', best[1]
    if key.startswith('xs-'):
        best = block_auto(key, 4, unit_re=r'^\s*Unit\s*(\d+)')
        return best[2], 'xs', best[1]
    if key.startswith('jk-'):
        best = block_auto(key, 4)
        if best is None:
            return [], 'jk', None
        return best[2], 'jk', best[1]
    if key.startswith('cj-'):
        cand = tail_candidates(key, r'Words\s+and\s+Expressions|Word\s*List')
        if not cand:
            return [], 'cj', None
        p0 = cand[0]
        rows = B.parse_tab(key, p0, p0 + 9)
        keep, _ = dedupe(rows)
        return keep, 'cj', p0
    if key.startswith('jj-'):
        pg = pages(key)
        n = max(pg)
        wiu = [p for p in sorted(pg) if p > n * 0.55 and 'Words in Each Unit' in pg[p]]
        if wiu:
            pass  # 该表只收「要求书写」的学习词汇，改用字母序全表
        starts = alpha_pages(key)
        if not starts:
            return [], 'jj-alpha', None
        p0 = starts[0]
        rows = alpha_parse(key, p0, n)
        ups = unit_starts_dots(key)
        cands = []
        if len(ups) >= 3:
            cands.append([(ups[i], (ups[i + 1] - 1) if i + 1 < len(ups) else 999) for i in range(len(ups))])
        d = dash_ranges(key)
        if d:
            cands.append(d)
        ranges = max(cands, key=lambda rs: sum(1 for r in rows if B.assign_unit(r['page'], rs))) if cands else []
        for r in rows:
            r['unit'] = B.assign_unit(r['page'], ranges)
        return [[r['unit'], r['word'], r['gloss'], False, r['page']] for r in rows], 'jj-alpha', p0
    if key.startswith('qh-'):
        starts = alpha_pages(key)
        if not starts:
            return [], 'qh', None
        pg = pages(key)
        p0 = starts[0]
        rows = alpha_parse(key, p0, max(pg))
        ups = unit_starts_dots(key)
        ranges = [(ups[i], (ups[i + 1] - 1) if i + 1 < len(ups) else 999) for i in range(len(ups))]
        for r in rows:
            r['unit'] = B.assign_unit(r['page'], ranges)
        return [[r['unit'], r['word'], r['gloss'], False, r['page']] for r in rows], 'qh', p0
    if key.startswith('bj-'):
        cand = tail_candidates(key, r'WORD\s*LIST\s*[（(]\s*1', 0.5)
        if not cand:
            return [], 'bj', None
        p0 = cand[0]
        rows = B.parse_lesson(key, p0, p0 + 3)
        return rows, 'bj', p0
    if key.startswith('ls-'):
        cand = tail_candidates(key, r'Words and expressions', 0.5)
        if not cand:
            return [], 'ls', None
        p0 = cand[0]
        rows = ls_parse(key, p0, p0 + 2)
        return [[u, w, g, False, None] for u, w, g in rows], 'ls', p0
    return [], '?', None


if __name__ == '__main__':
    keys = sys.argv[1:] or all_keys()
    summary = []
    for key in keys:
        if not text_ok(key):
            print(f'{key:8s} [扫描件，跳过]')
            continue
        rows, mode, p0 = run(key)
        units = {}
        for r in rows:
            units[r[0]] = units.get(r[0], 0) + 1
        print(f'{key:8s} {mode:9s} p0={str(p0):>4s} {len(rows):4d} 条  单元={sorted(units)}  '
              f'每单元={[(u, units[u]) for u in sorted(units)]}')
        summary.append(dict(book=key, mode=mode, p0=p0, n=len(rows), units=units))
        json.dump(dict(book=key, mode=mode, p0=p0,
                       words=[dict(unit=r[0], word=r[1], gloss=r[2], star=r[3], page=r[4]) for r in rows]),
                  open(os.path.join(HERE, key + '.words.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
    json.dump(summary, open(os.path.join(HERE, '_summary.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
