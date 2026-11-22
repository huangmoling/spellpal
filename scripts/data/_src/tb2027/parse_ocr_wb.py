# -*- coding: utf-8 -*-
"""扫描件词表解析：用 ocr_wb.py 产出的带 x 坐标结果（{页: [[[x, 文本], ...], ...]}）。

版式规律（北师大 Word Bank / 川教 Word List+Vocabulary / 湘少 Word List / 北京 Word List）：
- 双栏，左栏整栏读完再读右栏，`Unit N` / `Lesson N` 标题出现在栏内推进单元
- 单元格粒度是 OCR 检测框，一个框里常常是「word 释义」黏在一起 → 在第一个汉字处切
- 词形与释义折行（`* brave` / `勇敢的，无` + `畏的`）靠「纯中文格追加到上一条」拼接
- 纯数字（页码）、纯符号格丢弃
"""
import json
import os
import re

CJK = re.compile(r'[\u4e00-\u9fff]')
NUMWORD = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
           'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12}
UNIT_RE = re.compile(r'^Unit\s*([A-Za-z]+|\d{1,2})\b', re.I)
LESSON_RE = re.compile(r'^Lesson\s*(\d{1,2})\b', re.I)
HEADER_RE = re.compile(r'^(Word\s*Bank|Vocabulary|Word\s*List\s*(I{1,2})?|Words?\s*(and\s*expressions)?)$', re.I)
NOTE_RE = re.compile(r'注[:：]|课标|词汇表|要求|加粗|黑体白体|标注')
JUNK_RE = re.compile(r'^[\s\d*.()（）\-—/·,，、:：!！?？"“”\'’]+$')

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
OUT = os.path.join(ROOT, '.tmp', 'tb2ocr')


def load(key):
    p = os.path.join(OUT, key + '.wb.json')
    if not os.path.exists(p) or os.path.getsize(p) == 0:
        return {}
    return json.load(open(p, encoding='utf-8'))


def split_x(rows):
    """栏分界定位。

    词表是「词列 + 释义列」× 2 栏，页面上有四列 x，第 1/2 列之间和第 2/3 列
    之间的空白宽度差不多，靠「最大间隙」会切错。真正的分界有个内容特征：
    左边紧邻的是中文释义，右边紧邻的是英文词头。先按这个特征找，找不到
    （清华版每格是「word 释义」黏在一起、格内混排）再退回「大间隙」。
    """
    cand = []
    # 清华版一行是 [词条(中英混排), 页码, 词条, 页码]，分界在「页码 → 词条」
    for r in rows:
        cs = sorted(r, key=lambda c: c[0])
        for a, b in zip(cs, cs[1:]):
            if b[0] - a[0] < 80:
                continue
            if re.fullmatch(r'[（(]?\d{1,3}[)）]?', a[1].strip()) and CJK.search(b[1]):
                cand.append((a[0] + b[0]) / 2)
    if not cand:
        for r in rows:
            cs = sorted(r, key=lambda c: c[0])
            for a, b in zip(cs, cs[1:]):
                if b[0] - a[0] < 100:
                    continue
                if CJK.search(a[1]) and not CJK.search(b[1]):
                    cand.append((a[0] + b[0]) / 2)
    if not cand:
        for r in rows:
            cs = sorted(r, key=lambda c: c[0])
            for a, b in zip(cs, cs[1:]):
                if b[0] - a[0] >= 140 and CJK.search(a[1]) and CJK.search(b[1]):
                    cand.append((a[0] + b[0]) / 2)
    if not cand:
        return None
    cand.sort()
    return cand[len(cand) // 2]


def cut_cell(t):
    """一个 OCR 框 → [(kind, text)]，kind 为 'w'（词形/标题）或 'g'（释义）。"""
    t = t.strip()
    if not t:
        return []
    m = CJK.search(t)
    if not m:
        return [('w', t)]
    i = m.start()
    # `Chinese（学科）语文`：全角括号后跟汉字时，括号属于释义，不是词形
    p = t.find('（')
    if p != -1 and p < i:
        nxt = t[p + 1:p + 2]
        if nxt and CJK.match(nxt):
            i = p
    head, gloss = t[:i].strip(), t[i:].strip()
    out = []
    if head:
        out.append(('w', head))
    if gloss:
        out.append(('g', gloss))
    return out


def clean_head(h):
    h = re.sub(r'\s*[*＊★]\s*', ' ', h).strip()
    h = re.sub(r'\s+', ' ', h).strip(' .·')
    return h


def parse_col(rows_col, unit, out):
    """一栏的行（已按 y 排好）→ 追加到 out。返回 (结束 unit, 首个标题的 unit)。"""
    first = None
    for ykey, row in rows_col:
        toks = []
        for c in sorted(row, key=lambda c: c[0]):
            toks += cut_cell(c[1])
        if not toks:
            continue
        # 行首若是单元/课次标记，整行按标题处理（川教 `Unit 2` 与单元名分成两格）
        head0 = toks[0][1].strip()
        m = UNIT_RE.match(head0)
        if m and len(head0) <= 32:
            g = m.group(1).lower()
            unit = NUMWORD.get(g) or (int(g) if g.isdigit() else unit)
            if first is None:
                first = unit
            toks = toks[1:]               # 标题与首个词条常被 OCR 并成一行
            if not toks:
                continue
        elif LESSON_RE.match(head0) and len(head0) <= 16:
            toks = toks[1:]               # Lesson 只是分区，仍属当前 Unit
            if not toks:
                continue
        joined = ' '.join(t for _, t in toks).strip()
        if HEADER_RE.match(joined) or NOTE_RE.search(joined):
            continue
        for kind, txt in toks:
            mp = re.fullmatch(r'[（(]?(\d{1,3})[)）]?', txt.strip())
            if mp:
                if out:                      # 词条后面跟的 (页码)
                    out[-1][4] = int(mp.group(1))
                continue
            if kind == 'g':
                if out and len(out[-1][2]) < 40 and not NOTE_RE.search(txt):
                    out[-1][2] += txt
                continue
            # 词形
            if JUNK_RE.match(txt) or HEADER_RE.match(txt.strip()):
                continue
            h = clean_head(txt)
            if not h:
                continue
            if UNIT_RE.match(h) or LESSON_RE.match(h):
                continue
            out.append([unit, h, '', ykey, None])
    return unit, first


def parse(key, pages_rng):
    data = load(key)
    out = []
    unit = 0
    for p in pages_rng:
        rows = data.get(str(p)) or []
        if not rows:
            continue
        sx = split_x(rows)
        if sx is None:
            cols = [rows]
        else:
            cols = [[c for c in r if c[0] < sx] for r in rows], \
                   [[c for c in r if c[0] >= sx] for r in rows]
            cols = [[r for r in cols[0] if r], [r for r in cols[1] if r]]
        for ci, col in enumerate(cols):
            # 双栏是连续流：右栏顶部接着左栏底部，unit 直接延续
            unit, _first = parse_col(
                [(ci * 1000000 + p * 10000 + i * 10, r) for i, r in enumerate(col)],
                unit, out)
    # 合并同名重复（同一词可能被两页重复识别）
    if key.startswith('qh'):
        # 清华版词表是字母序、只有课本页码，单元靠「每单元 16 页」推算
        # （UNIT 1 从课本 p1 起，词表给的页码即课本页）
        for r in out:
            r[0] = min(4, (r[4] - 1) // 16 + 1) if r[4] else 0
    seen, keep = set(), []
    # 展示顺序：按单元归组，组内保持书上顺序；清华是字母序词表，直接按字母
    order = (lambda r: r[1].lower()) if key.startswith('qh') else (lambda r: (r[0] or 99, r[3]))
    for u, w, g, y, _pg in sorted(out, key=order):
        k = (w.lower(), u)
        if k in seen:
            continue
        seen.add(k)
        keep.append([u, w, g])
    return keep


if __name__ == '__main__':
    import sys
    from collections import Counter
    key = sys.argv[1]
    ps = [int(x) for x in sys.argv[2].split(',')]
    rows = parse(key, ps)
    print('条数', len(rows), sorted(Counter(r[0] for r in rows).items()))
    for u, w, g, *_ in rows:
        print('U%-2d %-26s %s' % (u, w, g))
