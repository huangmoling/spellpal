# -*- coding: utf-8 -*-
"""从课本正文抽候选句，按「命中本单元单词数」归到单元。"""
import json, glob, re, os, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TXT = r'F:/项目/学英语/spellpal/.tmp/tb2text'
BAD = {'ls-4b', 'ls-5a', 'ls-5b', 'ls-6a', 'ls-6b'}
CJK = re.compile(r'[\u4e00-\u9fff]')
SENT = re.compile(r"^[A-Z][A-Za-z ,.'’!?\-]*[.!?]$")


def pages(key):
    t = open(os.path.join(TXT, key + '.txt'), encoding='utf-8').read()
    t = ''.join(c for c in t if c == '\n' or c == '\t' or ord(c) >= 32 or c in '\u3000')
    ps = re.split(r'\n=== P(\d+) ===\n', t)
    return {int(ps[i]): ps[i + 1] for i in range(1, len(ps), 2)}


def norm_tok(w):
    w = w.lower().replace('’', "'")
    return re.sub(r"[^a-z']", '', w)


def candidates(key):
    out = []
    for p, body in pages(key).items():
        for ln in body.split('\n'):
            s = ln.strip().replace('\u2003', ' ')
            s = re.sub(r'\s+', ' ', s)
            if not SENT.match(s):
                continue
            if CJK.search(s) or re.search(r'\d', s):
                continue
            ws = s.split()
            if not (3 <= len(ws) <= 9):
                continue
            out.append(s)
    return out


def run(key):
    d = json.load(open(os.path.join(HERE, key + '.words.json'), encoding='utf-8'))
    unit_words = defaultdict(set)
    all_words = {}
    for w in d['words']:
        for tok in re.split(r"[\s\-–—/]+", w['word']):
            t = norm_tok(tok)
            if t:
                unit_words[w['unit']].add(t)
                all_words.setdefault(t, w['gloss'])
    cds = candidates(key)
    scored = []
    for s in cds:
        toks = [norm_tok(x) for x in s.split()]
        toks = [t for t in toks if t]
        best, bs = 0, 0
        for u, ws in unit_words.items():
            sc = sum(1 for t in toks if t in ws)
            if sc > bs:
                best, bs = u, sc
        if bs >= 2 and best:
            scored.append((best, bs, s))
    # 每单元取分高的前 6 句
    byu = defaultdict(list)
    seen = set()
    for u, sc, s in sorted(scored, key=lambda x: -x[1]):
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        if len(byu[u]) < 6:
            byu[u].append(s)
    return byu, all_words


if __name__ == '__main__':
    for key in sys.argv[1:]:
        byu, _ = run(key)
        print(f'### {key}: ' + ' '.join(f'U{u}:{len(v)}' for u, v in sorted(byu.items())))
        for u in sorted(byu)[:2]:
            print(f'  U{u}:', ' | '.join(byu[u]))
