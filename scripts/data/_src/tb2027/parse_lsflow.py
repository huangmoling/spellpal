# -*- coding: utf-8 -*-
"""辽师大版「Words and expressions」解析：整页左栏读完再读右栏，Unit 标题在栏内推进。

之前按「左半页 / 右半页各自跟踪 Unit」解析，右栏顶部的词（上一单元的后半截）
全部落成 U0。实际上词表是一条线性流：P78 左栏 → P78 右栏 → P79 左栏 → P79 右栏，
`Unit N` 标题出现在哪就切到哪个单元，跨栏不重置。

行内噪音统一在 merge_cells 处理：
- 印刷描边导致每个 token 重复（`have have a a fever fever`），去重保序
- 音标被切碎成 `/r` + `N/`，以「遇到音标即停止收词形」切分
- 词形被拆成多个格子（`played` + `games`），停止前全部拼上
"""
import re

from pdf_rows import rows_xy

CJK = re.compile(r'[\u4e00-\u9fff]')
UNIT_TAIL = re.compile(r'^Unit\b.*?(\d{1,2})$', re.I)
HEADER = re.compile(r'^(Words?|and|expressions?|Word\s*list)$', re.I)


def _is_ipa(t):
    if len(t) < 2:
        return False
    if t.startswith('/') or t.endswith('/'):
        return True
    # 整串只有 IPA 字符与重音符号
    return bool(re.fullmatch(r"[ˈˌːəɪʊɛɔæʌɑɒɜθðʃʒŋ%a-zA-Z:;'(),.\-]{1,12}", t)) and bool(re.search(r'[ˈˌːəɪʊɛɔæʌɑɒɜθðʃʒŋ]', t))


def _dedupe(texts):
    out, seen = [], set()
    for t in texts:
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def merge_cells(cells):
    """一个栏内的一行 → (kind, ...)。kind 是 UNIT / ENTRY。"""
    texts = _dedupe([t.strip() for _, _, t in sorted(cells, key=lambda c: c[0])])
    if not texts:
        return None
    joined = ' '.join(texts)
    if not CJK.search(joined):
        m = UNIT_TAIL.match(joined)
        if m:
            return ('UNIT', int(m.group(1)))
        if len(texts) == 1 and re.fullmatch(r'[\d*.]+', texts[0]):
            return None
        if all(HEADER.match(t) for t in texts):
            return None
        return None                      # 无汉字的行一律不算词条（页眉、页码、裸音标）
    heads, rest, stopped = [], [], False
    for t in texts:
        if stopped:
            rest.append(t)
            continue
        if CJK.search(t) or _is_ipa(t):
            stopped = True
            rest.append(t)
            continue
        heads.append(t)
    head = ' '.join(heads).strip()
    gloss = ''.join(t for t in rest if CJK.search(t)).strip()
    if not head or HEADER.match(head) or re.fullmatch(r'[\d*.]+', head):
        return None
    head = re.sub(r'^([a-zA-Z]+)\1$', r'\1', head)      # illill → ill
    head = re.sub(r'\s*[*＊]\s*', ' ', head).strip()
    return ('ENTRY', head, gloss)


def parse(key, pages_rng, split=230):
    out = []
    unit = 0
    for p in pages_rng:
        xy = rows_xy(key, p)
        for side in (0, 1):
            col = []
            for row in xy:
                cells = [c for c in row if (c[0] < split) == (side == 0)]
                if cells:
                    col.append(cells)
            for cells in col:
                got = merge_cells(cells)
                if not got:
                    continue
                if got[0] == 'UNIT':
                    unit = got[1]
                    continue
                _, head, gloss = got
                if gloss and '要求学生' in gloss:
                    continue
                out.append([unit, head, gloss])
    return out


if __name__ == '__main__':
    import sys
    from collections import Counter
    key = sys.argv[1]
    ps = [int(x) for x in sys.argv[2].split(',')]
    rows = parse(key, ps)
    print('条数', len(rows), sorted(Counter(r[0] for r in rows).items()))
    for u, w, g in rows:
        print('U%-2d %-25s %s' % (u, w, g))
