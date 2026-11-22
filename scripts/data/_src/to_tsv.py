#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把 _src/{bookId}.raw.json 转成 build-books.mjs 吃的 TSV。
  unit|word|ipaUK|cnShort|cnFull|syllables

音标策略：先从已上线的 19 册词库里按词形复用（同一词的音标不会因教材而变），
剩下的用 IPA_FILL 里的补充表（来源写在各条备注里），再缺就报错，不允许空着进库。
"""
import json
import io
import re
import os
import sys
import glob

ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

# 卡片上最多 12 字，太长的完整释义放 cnFull 那一列
SHORT_CN = {
    'grandfather': '祖父，外祖父',
    'grandmother': '祖母，外祖母',
    'uncle': '舅父，叔父，伯父',
    'aunt': '姑母，姨母，伯母',
    'child': '儿童，小孩',
}

# 现有词库里没有、需要单独补的音标（英式）。
# 来源：人人文库《3A新版(2024)单词表》/ manyfish 听写页 / 剑桥 & 牛津词典核对
IPA_FILL = {
    'good morning': '/ˌɡʊd ˈmɔːnɪŋ/',
    'good afternoon': '/ˌɡʊd ɑːftəˈnuːn/',
    'good evening': '/ˌɡʊd ˈiːvnɪŋ/',
    'nice to meet you': '/naɪs tə ˈmiːt juː/',
    'thank you': '/ˈθæŋk juː/',
    'happy birthday': '/ˈhæpi ˈbɜːθdeɪ/',
    'how lovely': '/haʊ ˈlʌvli/',
    'can i help you': '/kən aɪ ˈhelp juː/',
    'yes please': '/jes ˈpliːz/',
    'how old are you': '/haʊ əʊld ɑː juː/',
    'here you are': '/hɪər juː ɑː/',
    "you're welcome": '/jɔː ˈwelkəm/',
    'take pictures': '/teɪk ˈpɪktʃəz/',
    'are you ok': '/ɑː juː ˌəʊˈkeɪ/',
    'here i am': '/hɪər aɪ æm/',
    'excuse me': '/ɪkˈskjuːz miː/',
    'am': '/æm/',
    'ah': '/ɑː/',
    'not': '/nɒt/',
    'ha': '/hɑː/',
    'but': '/bʌt/',
    'oh': '/əʊ/',
    'with': '/wɪð/',
    'goodbye': '/ˌɡʊdˈbaɪ/',
    'quick': '/kwɪk/',
    'pond': '/pɒnd/',
    'come': '/kʌm/',
    'meet': '/miːt/',
    'please': '/pliːz/',
    'ok': '/ˌəʊˈkeɪ/',
    'dizzy': '/ˈdɪzi/',
    'er': '/ɜː/',
    'thing': '/θɪŋ/',

    # ---- 三下（3B）新增：现有 20 册词库里没有的词形 ----
    # 来源：manyfish 快乐听写《苏教译林版三下》逐条音标页 + 剑桥/牛津词典英式条目复核
    'rubber': '/ˈrʌbə(r)/',
    'that': '/ðæt/',
    'guess': '/ɡes/',
    'again': '/əˈɡen/',
    'good idea': '/ɡʊd aɪˈdɪə/',
    'our': '/ˈaʊə(r)/',
    'put away': '/pʊt əˈweɪ/',
    'let': '/let/',
    # 教辅页给的是弱读 /əs/，这里取词典的强读形式 /ʌs/（单词单念时听得到的就是这个）
    'us': '/ʌs/',
    'me too': '/miː tuː/',
    'all right': '/ɔːl raɪt/',
    'sit down': '/sɪt daʊn/',
    'look out of': '/lʊk aʊt əv/',
    'shh': '/ʃ/',
    'would you like': '/wʊd juː laɪk/',
    'look at': '/lʊk æt/',
    "that's all right": '/ðæts ɔːl raɪt/',
    'have fun': '/hæv fʌn/',
    'after class': '/ˈɑːftə(r) klɑːs/',
    'by': '/baɪ/',
    'break time': '/ˈbreɪk taɪm/',
    'outside': '/ˌaʊtˈsaɪd/',
    'art club': '/ˈɑːt klʌb/',
    'day': '/deɪ/',
    'butterfly': '/ˈbʌtəflaɪ/',
    'hey': '/heɪ/',
    'mango': '/ˈmæŋɡəʊ/',
    'they': '/ðeɪ/',
    'what about you': '/wɒt əˈbaʊt juː/',
    'how nice': '/haʊ naɪs/',
    'welcome to': '/ˈwelkəm tuː/',
    'lunchtime': '/ˈlʌntʃtaɪm/',
    'high five': '/haɪ faɪv/',
    'what colour': '/wɒt ˈkʌlə(r)/',
    'chameleon': '/kəˈmiːliən/',
    'what colour is': '/wɒt ˈkʌlə(r) ɪz/',
    'how come': '/haʊ kʌm/',
}

# 优先级最高的强制覆盖：现有词库里这几条要么是弱读、要么带可省音括号、
# 要么把 IPA 的 ɡ(U+0261) 写成了普通字母 g，都不能直接拿来用。
IPA_FORCE = {
    'an': '/æn/',            # 词库给的是弱读 /ən/，单词单念应是强读
    'beautiful': '/ˈbjuːtɪfl/',   # 词库写作 /ˈbjuːtɪf(ə)l/，孩子看不懂括号
    'little': '/ˈlɪtl/',
    'schoolbag': '/ˈskuːlbæɡ/',
    'tiger': '/ˈtaɪɡə(r)/',
    'green': '/ɡriːn/',
}


def norm(w):
    """词形归一：去括号补充、去标点、小写，仅用于查表"""
    w = re.sub(r'\s*\(.*?\)', '', w.strip())
    w = re.sub(r'[,.!?]', '', w)
    return re.sub(r'\s+', ' ', w).strip().lower()


def load_existing_ipa():
    table = {}
    for f in glob.glob(os.path.join(ROOT, 'src/data/books/*.json')):
        d = json.load(io.open(f, encoding='utf-8'))
        for w in d.get('words', []):
            if w.get('phoneticUK'):
                table.setdefault(norm(w['word']), w['phoneticUK'])
    return table


def syllables_of(word):
    """多词词组用 - 连成一块；单词保持原样。
    build 脚本会把音节拼起来和原词比对（忽略撇号/空格/连字符），
    所以这里必须原样保留大小写和句末标点，否则 Good morning. 会被判成不匹配。"""
    parts = word.split()
    if len(parts) > 1:
        return '-'.join(parts)
    return word


def main(book):
    raw_path = os.path.join(ROOT, 'scripts/data/_src', f'{book}.raw.json')
    raw = json.load(io.open(raw_path, encoding='utf-8'))
    existing = load_existing_ipa()

    rows, missing = [], []
    for u in raw['units']:
        for word, cn, star, page in u['words']:
            k = norm(word)
            ipa = IPA_FORCE.get(k) or existing.get(k) or IPA_FILL.get(k) or ''
            if not ipa:
                missing.append(f'U{u["no"]} {word}')
            short = SHORT_CN.get(k, cn)
            rows.append((u['no'], word, ipa, short, cn, syllables_of(word), star, page))

    if missing:
        print('缺音标，先补 IPA_FILL：')
        for m in missing:
            print('  ', m)
        sys.exit(1)

    out_path = os.path.join(ROOT, 'scripts/data', f'{book}.tsv')
    with io.open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        for unit, word, ipa, cn, cnfull, syl, _star, _page in rows:
            f.write('|'.join([str(unit), word, ipa, cn, cnfull, syl]) + '\n')

    total = len(rows)
    print(f'写入 {out_path}')
    print(f'{len(raw["units"])} 单元 / {total} 词条')
    for u in raw['units']:
        print(f'  U{u["no"]}: {len(u["words"])} 词  {u["title"]}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'yilin-3a')
