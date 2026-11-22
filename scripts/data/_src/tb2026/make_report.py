# -*- coding: utf-8 -*-
"""把各册 words.json 汇总成一份可逐条核对的 Markdown。

北京版词表按「课次」编排，这里套上课次→单元的映射
（Unit 1: 1-4，Unit 2: 5-8，Unit 3: 9-12，Unit 4: 13-14 Revision，
  Unit 5: 15-18，Unit 6: 19-22，Unit 7: 23-26，Unit 8: 27-28 Revision），
出自各册目录页，三册一致。
"""
import json, os, glob

OUT = os.path.dirname(os.path.abspath(__file__))
BJ_LESSON_UNIT = [(1, 4, 1), (5, 8, 2), (9, 12, 3), (13, 14, 4),
                  (15, 18, 5), (19, 22, 6), (23, 26, 7), (27, 28, 8)]

TITLES = {
    'bj-三a': '北京版 三年级上册', 'bj-四a': '北京版 四年级上册', 'bj-五a': '北京版 五年级上册',
    'hj-三a': '沪教牛津版 三年级上册', 'hj-四a': '沪教牛津版 四年级上册',
    'jk-三a': '教科版 三年级上册', 'jk-四a': '教科版 四年级上册', 'jk-六a': '教科版 六年级上册',
    'xs-三a': '湘少版 三年级上册', 'xs-四a': '湘少版 四年级上册',
    'xs-五a': '湘少版 五年级上册', 'xs-六a': '湘少版 六年级上册',
    'yl-五a': '译林版 五年级上册', 'yl-四a': '译林版 四年级上册',
    'hj-五a': '沪教牛津版 五年级上册', 'jk-五a': '教科版 五年级上册',
    'wy-三a': '外研版 三年级上册', 'wy-四a': '外研版 四年级上册', 'wy-五a': '外研版 五年级上册',
    'rj-三a': '人教版 三年级上册', 'rj-四a': '人教版 四年级上册',
}


def lesson_unit(n):
    for a, b, u in BJ_LESSON_UNIT:
        if a <= n <= b:
            return u
    return 0


def main():
    rows, lines = [], ['# 2026 秋新教材 · 词表汇总（待复核）', '',
                       '> 数据源：`F:\\桌面\\教材\\2026秋小学新教材` 各册 PDF 自带的 Word List / Vocabulary 页。',
                       '> 每个词条的释义逐字取自课本词表，未做同义改写。', '']
    total = 0
    for f in sorted(glob.glob(os.path.join(OUT, '*.words.json'))):
        d = json.load(open(f, encoding='utf-8'))
        k = d['book']
        words = d['words']
        # 统一成 unit
        for w in words:
            if 'unit' not in w:
                w['unit'] = lesson_unit(w.get('lesson', 0))
        total += len(words)
        units = {}
        for w in words:
            units.setdefault(w['unit'], []).append(w)
        has_ipa = sum(1 for w in words if w.get('ipaUK'))
        rows.append((k, TITLES.get(k, k), len(words), len(units), d['check'], has_ipa))
        lines.append(f'## {TITLES.get(k, k)}　`{k}`')
        lines.append('')
        lines.append(f'**{len(words)} 条 / {len(units)} 个单元**')
        lines.append('')
        for u in sorted(units):
            label = '专有名词（音标表未归单元）' if u == 0 else f'Unit {u}'
            lines.append(f'### {label}（{len(units[u])}）')
            lines.append('')
            lines.append('| # | 单词 | 音标 | 释义 | 标记 |')
            lines.append('|---|---|---|---|---|')
            for i, w in enumerate(units[u], 1):
                mark = '*' if w.get('star') else ''
                if w.get('page'):
                    mark = (mark + f' p{w["page"]}').strip()
                lines.append(f'| {i} | {w["word"]} | {w.get("ipaUK","")} | {w["gloss"]} | {mark} |')
            lines.append('')
        lines.append('---')
        lines.append('')
    head = ['| 册 | 书名 | 词条 | 单元 | 音标 | 交叉校验 |', '|---|---|---|---|---|---|']
    ipa_ok = {r[0]: r[5] for r in rows}
    for k, t, n, u, c, _h in rows:
        if 'index_count' in c:
            chk = f"字母索引 {c['index_count']}，差 {len(c['only_in_units'])}+{len(c['only_in_index'])}"
        elif 'index' in c:
            chk = f"索引 {c['index']}，缺释义 {len(c['missing_gloss'])}"
        else:
            chk = '无索引（单表）'
        head.append(f'| `{k}` | {t} | {n} | {u} | {ipa_ok[k]}/{n} | {chk} |')
    out = lines[:5] + head + ['', f'合计 **{total}** 条。', ''] + lines[5:]
    path = os.path.join(OUT, '_summary.md')
    open(path, 'w', encoding='utf-8').write('\n'.join(out))
    print('写出', path, len('\n'.join(out)), '字符,', total, '条')
    for k, t, n, u, c, _h in rows:
        print(f'  {k:8s} {n:4d} 条 {u:2d} 单元')


if __name__ == '__main__':
    main()
