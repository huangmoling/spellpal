# -*- coding: utf-8 -*-
"""定稿词表 → scripts/data/{book}.tsv，并打印 build-books.mjs 需要的元信息块。"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..'))

META = {
    'jj-3b': dict(
        id='jj-3b', title='义务教育教科书·英语（冀教版）三年级下册', shortTitle='三下·冀教',
        publisher='河北教育出版社', series='冀教版（三年级起点）', grade=3, term='down',
        edition='2025 春 · 新课标修订版',
        unitThemes={1: 'Food we like', 2: 'Good food, good health', 3: 'My day',
                    4: 'On the farm', 5: 'At the zoo', 6: 'My week'}),
    'cj-3b': dict(
        id='cj-3b', title='义务教育教科书·英语（川教版）三年级下册', shortTitle='三下·川教',
        publisher='四川教育出版社', series='川教版（三年级起点）', grade=3, term='down',
        edition='2025 春 · 新课标修订版',
        unitThemes={1: 'What’s This?', 2: 'I Have a Farm', 3: 'I Like This Dog',
                    4: 'This Is My Family', 5: 'What’s Your Job?',
                    6: 'Let’s Make a Birthday Card', 7: 'I Have Great Classmates',
                    8: 'Is It the Library?', 9: 'Who Is Your English Teacher?'}),
    'qh-3b': dict(
        id='qh-3b', title='义务教育教科书·英语（清华版）三年级下册', shortTitle='三下·清华',
        publisher='清华大学出版社', series='清华版（三年级起点）', grade=3, term='down',
        edition='2025 春 · 新课标修订版',
        unitThemes={1: 'Spring Semester Begins', 2: 'Where Do You Want to Go?',
                    3: 'Green Living', 4: 'Habits and Rules'}),
    'hj-3b': dict(
        id='hj-3b', title='义务教育教科书·英语（沪教版）三年级下册', shortTitle='三下·沪教',
        publisher='上海教育出版社', series='沪教版（三年级起点）', grade=3, term='down',
        edition='2025 春 · 新课标修订版',
        unitThemes={1: 'Hobbies', 2: 'Activities with friends', 3: 'Clothes',
                    4: 'Sounds I hear', 5: 'Colours', 6: 'Rooms in my home',
                    7: 'Places at school', 8: 'Children’s Day'}),
    'xs-3b': dict(
        id='xs-3b', title='义务教育教科书·英语（湘少版）三年级下册', shortTitle='三下·湘少',
        publisher='湖南少年儿童出版社', series='湘少版（三年级起点）', grade=3, term='down',
        edition='2025 春 · 新课标修订版',
        unitThemes={1: 'Greetings', 2: 'What time is it?', 3: 'Weather', 4: 'Clothes',
                    5: 'Numbers 13–20', 6: 'Fruit and vegetables',
                    7: 'Body parts and habits', 8: 'Children’s Day',
                    9: 'Transport', 10: 'Jobs'}),
    'ls-3b': dict(
        id='ls-3b', title='义务教育教科书·英语（辽师大版）三年级下册', shortTitle='三下·辽师大',
        publisher='辽宁师范大学出版社', series='辽师大版（三年级起点）', grade=3, term='down',
        edition='2025 春 · 新课标修订版',
        unitThemes={1: 'It’s a sunny day', 2: 'Spring is here', 3: 'This is beautiful',
                    4: 'Good habits', 5: 'I love it', 6: 'Let me help you'}),
}

VOW = 'aeiouy'
ONSETS = ('thr', 'shr', 'spl', 'spr', 'str', 'scr', 'sch', 'ch', 'sh', 'th', 'ph', 'wh',
          'qu', 'tr', 'dr', 'bl', 'br', 'cl', 'cr', 'fl', 'fr', 'gl', 'gr',
          'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tw')


def units_of(w):
    """粗分音节：两个元音之间单辅音归后、双辅音分半，常见辅音连缀不拆。"""
    w = w.lower()
    if len(w) <= 3 or not re.search(r'[aeiouy]', w):
        return [w]
    # 词尾不发音的 e 不单独成节
    cut = []
    i = 0
    n = len(w)
    vpos = [k for k in range(n) if w[k] in VOW]
    # 合并相邻元音（ea, oo, ai…）
    groups = []
    for k in vpos:
        if groups and k == groups[-1][-1] + 1:
            groups[-1].append(k)
        else:
            groups.append([k])
    if len(groups) <= 1:
        return [w]
    for gi in range(len(groups) - 1):
        a = groups[gi][-1]
        b = groups[gi + 1][0]
        gap = b - a - 1
        if gap <= 0:
            cut.append(b)
        elif gap == 1:
            # 单辅音归后一节（V-CV）；x 例外，归前
            cut.append(a + 2 if w[a + 1] == 'x' else b - 1)
        else:
            # 多辅音：合法连缀整体留给后一节；ck/ng 不能起头，归前一节
            seg = w[a + 1:b]
            if seg in ('ck', 'ng'):
                keep = 0
            elif len(seg) >= 3 and seg[-3:] in ONSETS:
                keep = 3
            elif seg[-2:] in ONSETS:
                keep = 2
            else:
                keep = 1
            cut.append(b - keep)
    # 词尾 e / 辅音+e 并回前一节；孤立的 e 不单独成节
    out, prev = [], 0
    for c in cut + [n]:
        part = w[prev:c]
        if part:
            out.append(part)
        prev = c
    for k in range(len(out) - 1, 0, -1):
        p = out[k]
        if p == 'e' or (re.fullmatch(r'[^aeiouy]+e', p) and not p.endswith(('le', 're'))):
            out[k - 1] += p
            out.pop(k)
    return out or [w]


def syllabify(word):
    """词组按空格、连字符分别切，连接符原样保留。"""
    out = []
    for chunk in word.split(' '):
        pieces, buf = [], ''
        for p in re.split(r'([-–—/])', chunk):
            if p in ('-', '–', '—', '/'):
                if buf:
                    pieces.append('-'.join(units_of(buf)))
                    buf = ''
                pieces.append(p)
            else:
                buf += p
        if buf:
            pieces.append('-'.join(units_of(buf)))
        out.append(''.join(pieces))
    return ' '.join(out)


def main():
    for book, meta in META.items():
        d = json.load(open(os.path.join(HERE, f'{book}.final.json'), encoding='utf-8'))
        rows = sorted(d['words'], key=lambda w: (w['unit'], 0))
        lines = []
        for w in rows:
            lines.append('|'.join([
                str(w['unit']), w['word'], w.get('ipaUK', ''), w['gloss'], w['gloss'],
                syllabify(w['word']),
            ]))
        open(os.path.join(OUT, f'{book}.tsv'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        print(f'{book}.tsv  {len(lines)} 行')
    # 打印元信息块
    print('\n/* ---------- 粘贴到 build-books.mjs 的 BOOKS ---------- */')
    for book, m in META.items():
        th = ',\n'.join(f"      {k}: '{v}'" for k, v in m['unitThemes'].items())
        print(f"""  '{book}': {{
    id: '{m['id']}',
    title: '{m['title']}',
    shortTitle: '{m['shortTitle']}',
    publisher: '{m['publisher']}',
    series: '{m['series']}',
    grade: {m['grade']},
    term: '{m['term']}',
    edition: '{m['edition']}',
    stage: 'primary',
    unitThemes: {{
{th},
    }},
  }},""")


if __name__ == '__main__':
    main()
