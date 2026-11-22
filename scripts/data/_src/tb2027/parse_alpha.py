# -*- coding: utf-8 -*-
"""字母序词表解析：词形（可能独占行）/ 释义（可能折行）/ 页码 三类行混排。"""
import re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_common import pages

CJK = re.compile(r'[\u4e00-\u9fff]')
WORDCH = re.compile(r"[A-Za-z][A-Za-z'’\-/().,=&…!? ]*")


def _clean(h):
    h = re.sub(r'^[*＊]\s*', '', h.strip())
    return re.sub(r'\s+', ' ', h).strip()


def parse(key, p_from, p_to, check_wordch=True):
    pg = pages(key)
    cur = None
    out = []
    pend = ''
    for p in range(p_from, p_to + 1):
        for ln in pg.get(p, '').split('\n'):
            s = ln.replace('\u2003', '  ').strip()
            if not s:
                continue
            if re.fullmatch(r'\d{1,3}', s):
                if cur and cur['page'] is None:
                    cur['page'] = int(s)
                continue
            m = re.fullmatch(r'[（(]\s*(\d{1,3})\s*[)）]', s)
            if m:
                if cur and cur['page'] is None:
                    cur['page'] = int(m.group(1))
                continue
            if re.fullmatch(r'[A-Z]', s):          # 字母分节标题
                pend = ''
                continue
            if CJK.search(s):
                i = CJK.search(s).start()
                pre, post = s[:i].strip(), s[i:].strip()
                head = _clean((pend + ' ' + pre) if pend else pre)
                pend = ''
                if head and (not check_wordch or WORDCH.fullmatch(head)):
                    out.append(dict(word=head, gloss=post, page=None))
                    cur = out[-1]
                elif cur:
                    cur['gloss'] += post
                continue
            pend = (pend + ' ' + s).strip()
    return out


if __name__ == '__main__':
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    rows = parse(key, a, b)
    pages_n = [r['page'] for r in rows if r['page']]
    print(f'{key}: {len(rows)} 条，有页码 {len(pages_n)}，页码范围 {min(pages_n) if pages_n else "-"}~{max(pages_n) if pages_n else "-"}')
    for r in rows[:14]:
        print(f"  {r['word']:28s} {r['gloss'][:24]:24s} p{r['page']}")
