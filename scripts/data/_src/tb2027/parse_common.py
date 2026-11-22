# -*- coding: utf-8 -*-
"""通用词表解析：适用于「按单元块排列」的版式（外研、沪教、湘少、译林）。

版式特征：词表正文以 "Unit N" 作为分隔标题，词条为「词形 + 分隔符 + 中文释义」，
释义折行时下一行只有汉字。北京版/人教版的字母索引另走 parse_bj / parse_rj。
"""
import re, os

TXT = r'F:\项目\学英语\spellpal\.tmp\tb2text'
CJK = re.compile(r'[\u4e00-\u9fff]')


def pages(key):
    t = open(os.path.join(TXT, key + '.txt'), encoding='utf-8').read()
    # 排版残留的控制字符（\x08 退格等）会粘在释义尾部，先清掉
    t = ''.join(c for c in t if c == '\n' or c == '\t' or ord(c) >= 32 or c in '\u3000')
    ps = re.split(r'\n=== P(\d+) ===\n', t)
    return {int(ps[i]): ps[i + 1] for i in range(1, len(ps), 2)}


def norm_key(w):
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)
    w = re.sub(r'\s+', ' ', w).strip().lower()
    return w


WORDCHARS = re.compile(r"[A-Za-z][A-Za-z'’\-/（）().,=&…!? ]*")


def clean_head(h):
    """去掉词形前的星号（课标二级词标记），返回 (词形, 是否二级词)。"""
    s = h.strip()
    star = s.startswith('*') or s.startswith('＊')
    if star:
        s = s.lstrip('*＊').strip()
    return s, star


def split_entry(line):
    """按行内第一个汉字切分 → (词形, 同行释义, 是否二级词)；不是词条返回 None。

    释义可能以全角括号开头（"to　（用于……）；向，到，往"），
    所以从汉字位置往前剥掉空白和左括号，剥掉的也算释义的一部分。
    """
    s = line.replace('\u2003', '  ').rstrip()
    if not s.strip():
        return None
    m = CJK.search(s)
    if m:
        left = s[:m.start()]
        stripped = left.rstrip(' \t\u3000（(')
        sep = left[len(stripped):]
        if not sep:                      # 词形和汉字之间没有分隔，不是词条行
            return None
        head, tail = stripped.strip(), s[len(stripped):].strip()
    else:
        head, tail = s.strip(), ''
    head, star = clean_head(head)
    if not WORDCHARS.fullmatch(head):
        return None
    return head, tail, star


def strip_page_ref(gloss):
    """释义末尾的页码引用（'习惯(8)'、'健康 (14)'）去掉，返回 (释义, 页码)。"""
    m = re.search(r'[（(]\s*(\d{1,3})\s*[)）]\s*$', gloss)
    if m:
        return gloss[:m.start()].strip(), int(m.group(1))
    return gloss, None


def parse_blocks(key, p_from, p_to, unit_re=r'^Unit\s*(\d+)', starters=()):
    """返回 [[unit, word, gloss]]，unit 为整数；starter 单元记为 0。"""
    pg = pages(key)
    cur = 0
    out = []
    for p in range(p_from, p_to + 1):
        lines = pg.get(p, '').split('\n')
        i = 0
        while i < len(lines):
            ln = lines[i]
            s = ln.strip()
            m = re.match(unit_re, s)
            if m:
                cur = int(m.group(1))
                i += 1
                continue
            if any(re.match(st, s) for st in starters):
                cur = 0
                i += 1
                continue
            got = split_entry(ln)
            if got:
                head, tail, star = got
                gloss_parts = [tail] if tail else []
                j = i + 1
                while j < len(lines):
                    nx = lines[j]
                    if nx.strip() == '' or not CJK.search(nx):
                        break
                    if split_entry(nx):
                        break
                    if re.match(unit_re, nx.strip()) or any(re.match(st, nx.strip()) for st in starters):
                        break
                    gloss_parts.append(nx.strip())
                    j += 1
                gloss = ''.join(gloss_parts).replace('\u3000', ' ').strip()
                gloss, page_ref = strip_page_ref(gloss)
                # 译林版把页码单独排成一行：(8)
                if page_ref is None:
                    k = j
                    while k < len(lines) and not lines[k].strip():
                        k += 1
                    if k < len(lines):
                        pm = re.fullmatch(r'[（(]\s*(\d{1,3})\s*[)）]', lines[k].strip())
                        if pm:
                            page_ref = int(pm.group(1))
                            j = k + 1
                if gloss:                      # 没有释义的是单元标题之类，不当词条
                    out.append([cur, head, gloss, star, page_ref])
                i = j
                continue
            i += 1
    return out


def dedupe(rows):
    """同一单元内同词形只留第一条，返回 (去重结果, 重复项)。"""
    seen, keep, dup = {}, [], []
    for r in rows:
        u, w = r[0], r[1]
        k = (u, norm_key(w))
        if k in seen:
            dup.append(r)
            continue
        seen[k] = True
        keep.append(r)
    return keep, dup


if __name__ == '__main__':
    import sys
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    unit_re = sys.argv[4] if len(sys.argv) > 4 else r'^Unit\s*(\d+)\s*$'
    rows = parse_blocks(key, a, b, unit_re=unit_re)
    keep, dup = dedupe(rows)
    print(f'{key}: 原始 {len(rows)} 条，去重后 {len(keep)}，重复 {len(dup)}')
    for u, w, g, st, pr in keep:
        print(f'U{u:<2} {"*" if st else " "}{w:30s} {g}{"  p"+str(pr) if pr else ""}')
    if dup:
        print('--- 重复 ---')
        for u, w, g, st, pr in dup:
            print(f'U{u:<2} {w:24s} {g}')
