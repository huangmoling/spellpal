# -*- coding: utf-8 -*-
"""给 tb2026 下的全部册次补齐音标。

取值优先级：
  1. 程序里已上线 21 册的 phoneticUK（1050 条，人工校验过的学习者词典记法）
  2. 人教课本词汇表自带的音标
  3. 人工填表 MANUAL（Wiktionary 缺 RP 或记法不合用时逐条指定）
  4. Wiktionary RP 音标（经 ipa_wikt.normalize 归一）
词组按词拆分后逐段拼接，空格保留、连字符保留。
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ipa_wikt import normalize  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))

# 逐条人工指定：Wiktionary 无 RP 标注、或它给的记法与本项目惯例不符。
# 专有名词按英式通用读音，派生词按学习者词典（牛津/朗文）写法。
MANUAL = {
    'a.m': '/ˌeɪ ˈem/', 'p.m': '/ˌpiː ˈem/', 'un': '/ˌjuː ˈen/',
    'asia': '/ˈeɪʒə/', 'africa': '/ˈæfrɪkə/', 'europe': '/ˈjʊərəp/',
    'america': '/əˈmerɪkə/', 'north america': '/ˌnɔːθ əˈmerɪkə/',
    'british': '/ˈbrɪtɪʃ/', 'canadian': '/kəˈneɪdiən/',
    'paris': '/ˈpærɪs/', 'rome': '/rəʊm/', 'venice': '/ˈvenɪs/',
    'new delhi': '/ˌnjuː ˈdeli/', 'delhi': '/ˈdeli/',
    'river thames': '/ˌrɪvə ˈtemz/', 'thames': '/temz/',
    'washington d.c': '/ˌwɒʃɪŋtən ˌdiː ˈsiː/', 'washington': '/ˈwɒʃɪŋtən/',
    'the eiffel tower': '/ði ˈaɪfl ˈtaʊə(r)/', 'eiffel': '/ˈaɪfl/',
    'santa claus': '/ˌsæntə ˈklɔːz/', 'santa': '/ˈsæntə/', 'claus': '/klɔːz/',
    'pigsy': '/ˈpɪgzi/', 'olympics': '/əˈlɪmpɪks/',
    'meatball': '/ˈmiːtbɔːl/', 'honeybee': '/ˈhʌnibiː/',
    'policewoman': '/pəˈliːswʊmən/', 'storybook': '/ˈstɔːribʊk/',
    'healthily': '/ˈhelθɪli/', 'recyclable': '/ˌriːˈsaɪkləbl/',
    'miaow': '/miˈaʊ/', 'chores': '/tʃɔːz/',
    'mooncakes': '/ˈmuːnkeɪks/', 'lanterns': '/ˈlæntənz/',
    'photos': '/ˈfəʊtəʊz/',
    "that's enough": '/ðæts ɪˈnʌf/',
    "on one's own": '/ɒn wʌnz ˈəʊn/',
    "on one's way back": '/ɒn wʌnz weɪ ˈbæk/',
    'take photos': '/teɪk ˈfəʊtəʊz/',
    'do chores': '/duː tʃɔːz/',
    'eat mooncakes': '/iːt ˈmuːnkeɪks/',
    'watch lanterns': '/wɒtʃ ˈlæntənz/',
    "let's": '/lets/',
    # ---- 复核时逐条发现并修正的（Wiktionary 取错条目或记法不合用）----
    'another': '/əˈnʌðə(r)/', 'quite': '/kwaɪt/', 'reduce': '/rɪˈdjuːs/',
    'natural resources': '/ˈnætʃrəl rɪˈsɔːsɪz/',
    'end': '/end/', 'tram': '/træm/', 'musical': '/ˈmjuːzɪkl/',
    'real': '/rɪəl/', 'carefully': '/ˈkeəfəli/', 'lots of': '/lɒts ɒv/',
    'sports ground': '/spɔːts graʊnd/', 'feeder': '/ˈfiːdə(r)/',
    'zookeeper': '/ˈzuːkiːpə(r)/', 'skiing': '/ˈskiːɪŋ/',
    'national': '/ˈnæʃnəl/', 'because of': '/bɪˈkɒz ɒv/',
    'listen to some music': '/ˈlɪsn tuː səm ˈmjuːzɪk/',
    'twenty-eight': '/ˌtwenti ˈeɪt/', 'sixty-eight': '/ˌsɪksti ˈeɪt/',
    'twenty-four': '/ˌtwenti ˈfɔː(r)/', 'yeah': '/jeə/',
    'whoosh': '/wʊʃ/', 'yourself': '/jɔːˈself/',
    'surprise': '/səˈpraɪz/', 'number': '/ˈnʌmbə(r)/',
    'make jiaozi': '/meɪk ˈdʒaʊzi/',
    'tomb-sweeping day': '/ˌtuːm ˈswiːpɪŋ deɪ/',
    'indigo': '/ˈɪndɪɡəʊ/', 'be': '/biː/',
}


def norm(w):
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w.strip())
    w = re.sub(r'[,.!?]', '', w)
    return re.sub(r'\s+', ' ', w).strip().lower()


def load_library():
    lib = {}
    for f in glob.glob(os.path.join(ROOT, 'src/data/books/*.json')):
        d = json.load(open(f, encoding='utf-8'))
        for w in d.get('words', []):
            if w.get('phoneticUK'):
                lib.setdefault(norm(w['word']), w['phoneticUK'])
    for k in ('rj-三a', 'rj-四a'):
        p = os.path.join(HERE, k + '.words.json')
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding='utf-8'))
        for w in d['words']:
            if w.get('ipa'):
                lib.setdefault(norm(w['word']), '/' + w['ipa'] + '/')
    return lib


def load_wikt():
    p = os.path.join(HERE, '.wikt-cache.json')
    if not os.path.exists(p):
        return {}
    raw = json.load(open(p, encoding='utf-8'))
    out = {}
    for k, v in raw.items():
        if isinstance(v, str) and v:
            out[k] = normalize(v, k)
    return out


def lookup(tok, lib, wikt):
    # 课本用的是弯引号 ’，词典键统一成直引号
    k = tok.lower().replace('’', "'").strip(".'’ ")
    if not k:
        return None
    return lib.get(k) or MANUAL.get(k) or wikt.get(k)


def query_key(w):
    """把课本词形清洗成可查词典的形式。

    课本里常见几种附属写法，都不参与读音：
      'be (am, is, are)'      → be
      'dad（father）'          → dad
      'a/an'                  → a
      "let's = let us"        → let's
      'take care of sb / sth' → take care of
    """
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)
    w = re.sub(r'\s*=\s*.*$', '', w)
    w = re.sub(r'\b(sb|sth)\b', '', w)
    w = w.split('/')[0]
    return re.sub(r'\s+', ' ', w).strip()


def build_ipa(word, lib, wikt):
    whole = lookup(query_key(word), lib, wikt)
    if whole:
        return whole
    segs = []
    for part in query_key(word).split():
        pieces = []
        for piece in re.split(r'([-–—])', part):
            if piece in ('-', '–', '—'):
                pieces.append(piece)
                continue
            ipa = lookup(piece, lib, wikt)
            if not ipa:
                return None
            pieces.append(ipa.strip('/'))
        segs.append(''.join(pieces))
    return '/' + ' '.join(segs) + '/' if segs else None


def main():
    lib, wikt = load_library(), load_wikt()
    print(f'音标库 {len(lib)} 条，Wiktionary {len(wikt)} 条')
    grand = dict(total=0, filled=0, missing=[])
    for f in sorted(glob.glob(os.path.join(HERE, '*.words.json'))):
        d = json.load(open(f, encoding='utf-8'))
        miss, n = [], 0
        for w in d['words']:
            n += 1
            ipa = build_ipa(w['word'], lib, wikt)
            if ipa:
                w['ipaUK'] = ipa
            else:
                w.pop('ipaUK', None)
                miss.append(w['word'])
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        grand['total'] += n
        grand['filled'] += n - len(miss)
        grand['missing'] += [(d['book'], m) for m in miss]
        print(f"  {d['book']:8s} {n:4d} 词，缺 {len(miss):3d}", (miss[:6] if miss else ''))
    print(f"合计 {grand['total']} 词，补齐 {grand['filled']}，仍缺 {len(grand['missing'])}")
    if grand['missing']:
        json.dump(grand['missing'], open(os.path.join(HERE, '.missing-ipa.json'), 'w',
                  encoding='utf-8'), ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()
