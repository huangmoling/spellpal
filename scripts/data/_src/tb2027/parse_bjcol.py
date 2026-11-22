# -*- coding: utf-8 -*-
"""北京版 Word List (1) 按坐标解析：左右两栏各属一个 Unit，栏内行首的纯数字是课次号。

新版（2025 春）的 Word List (1) 是「左栏 Unit One / 右栏 Unit Two」的双栏版式，
文字层顺序完全乱（右栏内容先出），只能靠 x 坐标还原。每栏第一行是 `Unit One`
这样的标题，单元归属就从这里读，不用再去目录页猜 Lesson→Unit。
"""
import re

from pdf_rows import rows_xy

CJK = re.compile(r'[\u4e00-\u9fff]')
NUMWORD = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
           'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12}
UNIT = re.compile(r'^Unit\s+([A-Za-z]+|\d+)$', re.I)
WORD_OK = re.compile(r"^[A-Za-z][A-Za-z'’\-/（）().,=& ]*$")
SPLIT_X = 220          # 左栏 x0 全部 <200，右栏全部 >260
Y_TOL = 7


def parse_page(key, pno, split=SPLIT_X):
    """返回 [(unit, word, gloss)]，按页内左右栏顺序。"""
    xy = rows_xy(key, pno)
    # rows_xy 返回 [[(x0,x1,text)...], ...] 已按 y 聚好行；这里按 x0 判栏
    left, right = [], []
    for row in xy:
        cl = [c for c in row if c[0] < split]
        cr = [c for c in row if c[0] >= split]
        if cl:
            left.append(sorted(cl, key=lambda c: c[0]))
        if cr:
            right.append(sorted(cr, key=lambda c: c[0]))
    out = []
    for col in (left, right):
        unit = 0
        for row in col:
            texts = []
            for _, _, t in row:            # 印刷描边会让每个字重复一遍，压掉相邻重复
                t = t.strip()
                if t and (not texts or texts[-1] != t):
                    texts.append(t)
            if not texts:
                continue
            joined = ' '.join(texts).strip()
            m = UNIT.match(joined)
            if m:
                g = m.group(1).lower()
                unit = NUMWORD.get(g) or (int(g) if g.isdigit() else unit)
                continue
            # 纯课次号 / 星号 / 页码行
            if all(re.fullmatch(r'[\d*]+', t) for t in texts):
                continue
            # 找最后一个含汉字的格子，它右边全是释义
            gi = None
            for i, t in enumerate(texts):
                if CJK.search(t):
                    gi = i
            if gi is None:
                head = joined
                if WORD_OK.match(head):
                    out.append([unit, head, ''])
                continue
            if gi == 0:
                # 整行只有释义：接到上一条的释义后面（脚注行不算）
                if out and not re.search(r'注：|课标|词汇\)|词汇）', joined):
                    out[-1][2] += joined
                continue
            head = ' '.join(texts[:gi]).strip()
            gloss = ''.join(texts[gi:]).strip()
            head = re.sub(r'\s*[*＊]\s*', ' ', head).strip()
            if not head or not WORD_OK.match(head):
                continue
            out.append([unit, head, gloss])
    return out


def parse(key, pages_rng):
    out = []
    for p in pages_rng:
        out += parse_page(key, p)
    return out


if __name__ == '__main__':
    import sys
    key = sys.argv[1]
    ps = [int(x) for x in sys.argv[2].split(',')]
    for u, w, g in parse(key, ps):
        print('U%-2d %-24s %s' % (u, w, g))
