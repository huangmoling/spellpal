# -*- coding: utf-8 -*-
"""人教版 Vocabulary 解析。

版式（Appendix 4/3 Vocabulary）：
    *air /eə(r)/ 空气	p. 40
    *aunt /ɑːnt/ 伯母；婶母；
    *舅母；姑母；姨母		p. 20

特点：字母序、每条带 /音标/ 与页码；释义折行的续行也带一个 '*' 前缀。
只有带 /…/ 的行才是新词条，靠这一点切分最稳。
"""
import re, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_blocks import pages

IPA = re.compile(r'/([^/]+)/')


def scan_entry(line):
    """扫描一条词条，返回 (词形, 音标, 剩余文本) 或 None。

    词组会写成交替形式：'a lot /lɒt/ of /əv/ 大量；许多'，
    要一直吸收「英文词 + 音标」直到遇到汉字或行尾。
    """
    if not IPA.search(line):
        return None
    s = line.lstrip('*').lstrip()
    parts, ipas, pos = [], [], 0
    while True:
        m = re.match(r"\s*([A-Za-z][A-Za-z'’\-]*)", s[pos:])
        if not m:
            break
        parts.append(m.group(1))
        pos += m.end()
        p = re.match(r'\s*/([^/]+)/', s[pos:])
        if p:
            ipas.append(p.group(1))
            pos += p.end()
        if re.match(r'\s*[\u4e00-\u9fff]', s[pos:]) or pos >= len(s):
            break
    if not parts or not ipas:
        return None
    return ' '.join(parts), ' '.join(ipas), s[pos:].strip()


def parse(key, p_from, p_to):
    pg = pages(key)
    rows = []
    cur = None
    for p in range(p_from, p_to + 1):
        for raw in pg.get(p, '').split('\n'):
            line = raw.replace('\t', '  ').rstrip()
            if not line.strip():
                continue
            got = scan_entry(line)
            if got:
                head, ipa, rest = got
                page = None
                pm = re.search(r'p\.\s*(\d+)', rest)
                if pm:
                    page = int(pm.group(1))
                    rest = rest[:pm.start()]
                rows.append(dict(word=head, ipa=ipa, gloss=rest.strip(), page=page))
                cur = rows[-1]
                continue
            if cur is None:
                continue
            # 续行：去前缀星号，接释义；也可能只有页码
            t = line.strip().lstrip('*').strip()
            pm = re.fullmatch(r'p\.\s*(\d+)', t)
            if pm:
                cur['page'] = cur['page'] or int(pm.group(1))
                continue
            if re.search(r'[\u4e00-\u9fff]', t):
                pm2 = re.search(r'p\.\s*(\d+)', t)
                if pm2:
                    cur['page'] = cur['page'] or int(pm2.group(1))
                    t = t[:pm2.start()]
                cur['gloss'] += t.strip()
    return rows


if __name__ == '__main__':
    key, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    rows = parse(key, a, b)
    print(f'{key}: {len(rows)} 条')
    for r in rows:
        print(f"{r['word']:26s} /{r['ipa']}/  {r['gloss']}  p{r['page']}")
