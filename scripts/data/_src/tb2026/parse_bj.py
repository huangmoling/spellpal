# -*- coding: utf-8 -*-
"""北京版词表解析：Word List (1) 取释义，Word List (2) 取课次号，按单词 join。

Word List (1) 取词形+释义的难点：释义会折行（"nice / 令人愉快的，/ 令人高兴的"），
且页面里混着 "Unit One"、"2 3 4" 这类版式残渣，必须按「行尾带 TAB 且不含汉字」识别词条。
"""
import re, json, sys, os

TXT = r'F:\项目\学英语\spellpal\.tmp\tbtext'
OUT = r'F:\项目\学英语\spellpal\scripts\data\_src\tb2026'


def pages(key):
    t = open(os.path.join(TXT, key + '.txt'), encoding='utf-8').read()
    ps = re.split(r'\n=== P(\d+) ===\n', t)
    return {int(ps[i]): ps[i + 1] for i in range(1, len(ps), 2)}


CJK = re.compile(r'[\u4e00-\u9fff]')


def norm_key(w):
    """归一化词形用于两张表对齐：去括号补充、去标点、压空格、小写。"""
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)
    w = re.sub(r'\s+', ' ', w).strip().lower()
    return w


def split_entry(line, keys):
    """把一行拆成 (词形, 同行释义)；不是词条就返回 None。

    做法：找行内第一个汉字，左边去掉分隔符就是词形，右边就是释义。
    这样 '\t'、U+2003、单个或多个空格都能吃下，'man（ pl. men） 男人' 也不会漏。
    """
    s = line.replace('\u2003', '  ').rstrip()
    if not s.strip():
        return None
    m = CJK.search(s)
    if m:
        left = s[:m.start()].rstrip(' \t\u3000')
        sep = s[len(left):m.start()]
        if not sep:                      # 词形和汉字之间没有分隔，不是词条行
            return None
        head, tail = left.strip(), s[m.start():].strip()
    else:
        head, tail = s.strip(), ''
    if not re.fullmatch(r"[A-Za-z][A-Za-z'’\-/（）().,=& ]*", head):
        return None
    if head.lower().startswith('word list'):
        return None
    # 没有释义的裸词形，必须是索引里认识的词，否则可能是 'Unit Three' 这类版式文字
    if not tail and keys is not None and norm_key(head) not in keys:
        return None
    return head, tail


def parse_list1(text, keys=None):
    """返回 [[word, gloss]]，保持页面顺序。释义折行时后续纯汉字行接上。"""
    lines = text.split('\n')   # 不能用 rstrip()，会把行尾的 TAB 一起吃掉
    out, i = [], 0
    while i < len(lines):
        got = split_entry(lines[i], keys)
        if got:
            head, tail = got
            gloss_parts = [tail] if tail else []
            j = i + 1
            while j < len(lines):
                nx = lines[j]
                if nx.strip() == '':
                    # 释义栏里可能夹空行（排版留白），跳过继续找汉字行
                    if j + 1 < len(lines) and CJK.search(lines[j + 1]) and not split_entry(lines[j + 1], keys):
                        j += 1
                        continue
                    break
                if not CJK.search(nx):
                    break
                # 下一行本身就是「词形 + 释义」，说明本词条已结束
                if split_entry(nx, keys):
                    break
                gloss_parts.append(nx.strip())
                j += 1
            gloss = ''.join(gloss_parts).replace('\u3000', ' ').strip()
            out.append([head, gloss])
            i = j
            continue
        i += 1
    return out


def parse_list2(text):
    """返回 [[word, num]]，从字母索引里抽 'word (num)'。

    词形里可能带等号（'maths (=mathematics, AmE math)(2)'），
    字符类必须放行 '=' '&'，否则会被从括号内部切开。
    """
    pairs = []
    for m in re.finditer(r"([A-Za-z][A-Za-z'\u2019\-/ ().,=&]*?)\s*\((\d+)\)", text):
        w = re.sub(r'\s+', ' ', m.group(1)).strip()
        if w and w.lower() != 'word list':
            pairs.append([w, int(m.group(2))])
    return pairs


def build(key, list1_pages, list2_pages):
    pg = pages(key)
    l2 = []
    for p in list2_pages:
        l2 += parse_list2(pg[p])
    keys = {norm_key(w) for w, _ in l2}
    l1 = []
    for p in list1_pages:
        l1 += parse_list1(pg[p], keys)
    return l1, l2


if __name__ == '__main__':
    key = sys.argv[1] if len(sys.argv) > 1 else 'bj-三a'
    p1 = [int(x) for x in sys.argv[2].split(',')]
    p2 = [int(x) for x in sys.argv[3].split(',')]
    l1, l2 = build(key, p1, p2)
    print(f'List1 词条 {len(l1)}   List2 索引 {len(l2)}')
    d1 = {}
    for w, g in l1:
        d1.setdefault(norm_key(w), (w, g))
    d2 = {}
    for w, n in l2:
        d2.setdefault(norm_key(w), (w, n))
    print('List1 only:', [w for w, _ in l1 if norm_key(w) not in d2])
    print('List2 only:', [w for w, _ in l2 if norm_key(w) not in d1])
    print(f'--- 全部 {len(l2)} 条 ---')
    for w, n in l2:
        hw, gl = d1.get(norm_key(w), (w, '??'))
        print(f'{n:3d}  {w:24s} {gl}')
