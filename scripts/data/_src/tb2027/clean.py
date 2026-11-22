# -*- coding: utf-8 -*-
"""词表清洗：去脚注、去音标、修词形、把整句挪到 patterns。"""
import json, glob, re, os, sys

CJK = re.compile(r'[\u4e00-\u9fff]')
IPA = re.compile(r'/[^/\s]{1,24}/')
BAD_WORD = re.compile(r'^(word list|vocabulary|contents|unit)$', re.I)
FRAG = re.compile(r'^[a-z]{1,4}$')


def fix_word(w):
    w = w.strip()
    w = re.sub(r'^[*＊]+\s*', '', w)
    w = re.sub(r'\s*[（(]pl\.[^)）]*[)）]', '', w)
    w = w.replace('\u2026', ' … ')
    w = re.sub(r'\s+', ' ', w).strip()
    return w


def fix_gloss(g):
    g = IPA.sub('', g)
    g = re.split(r'注：|说明：', g)[0]
    g = re.sub(r'(?:第[一二三四五六七八九十]+|本)\s*册.*$', '', g)
    g = re.sub(r'be（am/is/are）是', '', g)
    g = g.replace('\u2003', ' ').replace('\u3000', ' ')
    return re.sub(r'\s+', ' ', g).strip(' ;；,，')


def is_sentence(w):
    if re.search(r'[!?！？]', w):
        return True
    if '…' in w or '...' in w:
        return True
    if '/' in w:
        return True
    # 以句号收尾且不止一个词 —— 课本句型表里混进词表的都是这种
    if re.search(r'\.\s*$', w) and len(w.split()) >= 2:
        return True
    return False


def run():
    stat = []
    for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), '*.words.json'))):
        key = os.path.basename(f)[:-11]
        d = json.load(open(f, encoding='utf-8'))
        keep, pat, drop = [], [], []
        seen = set()
        for w in d['words']:
            wd = fix_word(w['word'])
            gl = fix_gloss(w['gloss'])
            if not wd or BAD_WORD.match(wd):
                drop.append(w['word']); continue
            if not gl or not CJK.search(gl):
                continue
            if is_sentence(wd):
                pat.append(dict(unit=w['unit'], word=wd, gloss=gl, page=w.get('page')))
                continue
            k = (w['unit'], wd.lower())
            if k in seen:
                continue
            seen.add(k)
            keep.append(dict(unit=w['unit'], word=wd, gloss=gl, star=w.get('star', False), page=w.get('page')))
        d['words'] = keep
        d['patterns'] = (d.get('patterns') or []) + pat
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        stat.append((key, len(keep), len(pat), len(drop)))
    for k, n, p, x in stat:
        print(f'{k:8s} {n:4d} 词  句型 {p:3d}  丢弃 {x}')
    print('合计', sum(s[1] for s in stat), '词，', sum(s[2] for s in stat), '句型')


if __name__ == '__main__':
    run()
