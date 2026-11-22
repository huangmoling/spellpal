# -*- coding: utf-8 -*-
"""给 tb2027 词表补英式音标：现库复用 → 旧 Wiktionary 缓存 → 逐词人工表。"""
import json, glob, re, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

CJK = re.compile(r'[\u4e00-\u9fff]')
IPA = re.compile(r'/[^/\s]{1,24}/')
BAD = {'ls-4b', 'ls-5a', 'ls-5b', 'ls-6a', 'ls-6b'}


def norm(w):
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)
    w = re.sub(r'[,.!?]', '', w)
    w = w.replace('…', ' ')
    return re.sub(r'\s+', ' ', w).strip().lower()


def load_lib():
    lib = {}
    for f in glob.glob(os.path.join(ROOT, 'src/data/books/*.json')):
        d = json.load(open(f, encoding='utf-8'))
        for w in d.get('words', []):
            if w.get('phoneticUK'):
                lib.setdefault(norm(w['word']), w['phoneticUK'])
    for f in glob.glob(r'F:/项目/学英语/spellpal/scripts/data/_src/tb2026/*.words.json'):
        d = json.load(open(f, encoding='utf-8'))
        for w in d.get('words', []):
            if w.get('ipaUK'):
                lib.setdefault(norm(w['word']), w['ipaUK'])
    return lib


def load_wikt():
    p = r'F:/项目/学英语/spellpal/scripts/data/_src/tb2026/.wikt-cache.json'
    try:
        c = json.load(open(p, encoding='utf-8'))
    except Exception:
        return {}
    out = {}
    for k, v in c.items():
        if isinstance(v, str) and v:
            out[k.lower()] = v if v.startswith('/') else '/' + v + '/'
    return out


def lookup(tok, lib, wikt):
    k = tok.lower().strip(".'’,;:")
    if not k:
        return None
    return lib.get(k) or wikt.get(k)


def build(word, lib, wikt):
    whole = lookup(norm(word), lib, wikt)
    if whole:
        return whole
    segs = []
    for part in word.replace('…', ' ').split():
        pieces = []
        for piece in re.split(r'([-–—])', part):
            if piece in ('-', '–', '—'):
                pieces.append('-')
                continue
            ipa = lookup(piece, lib, wikt)
            if not ipa:
                return None
            pieces.append(ipa.strip('/'))
        segs.append(''.join(pieces))
    return '/' + ' '.join(segs) + '/' if segs else None


def run():
    lib, wikt = load_lib(), load_wikt()
    missing = []
    tot = got = 0
    for f in sorted(glob.glob(os.path.join(HERE, '*.words.json'))):
        key = os.path.basename(f)[:-11]
        if key in BAD:
            continue
        d = json.load(open(f, encoding='utf-8'))
        for w in d['words']:
            tot += 1
            ipa = build(w['word'], lib, wikt)
            if ipa:
                w['ipaUK'] = ipa
                got += 1
            else:
                w.pop('ipaUK', None)
                missing.append((key, w['word']))
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{got}/{tot} 有音标，缺 {len(missing)}')
    json.dump(missing, open(os.path.join(HERE, '.missing-ipa.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    for m in missing[:15]:
        print('   ', m)


if __name__ == '__main__':
    run()
