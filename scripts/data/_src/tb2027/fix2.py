# -*- coding: utf-8 -*-
"""第二轮词形修正：连字、括号碎片、字库错字、非词条。

这批 PDF 的文字层有三类系统性破坏：
1. **连字**：ﬁ ﬂ ﬃ ﬄ 等 Unicode 连字被原样吐出（`ﬂower` → `flower`）
2. **括号碎片**：`be (am, is, are)` 在文本层被切成 `be is, are)`；释义里的
   `（分手指的）手套` 被切成词形 `glove (` + 释义 `分手指的)手套`
3. **字库错字**：`emercise`(exercise)、`magaoine`(magazine)、`nemt`(next)

前两类按规则修，第三类只能逐条列出来（见 FIX）。
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

LIG = {'\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi',
       '\ufb04': 'ffl', '\ufb05': 'ft', '\ufb06': 'st'}

# 显式修正：原样（小写） → (新词形, 新释义, 新音标)；None 表示剔除
FIX = {
    'bef efore ore': ('before', '在……之前', '/bɪˈfɔː(r)/'),
    'be befo fore re bed': ('before bed', '睡前', '/bɪˈfɔː bed/'),
    'colo colour ur ame color)': ('colour', '颜色', '/ˈkʌlə(r)/'),
    'emercise': ('exercise', '锻炼；运动', '/ˈeksəsaɪz/'),
    'magaoine': ('magazine', '杂志', '/ˌmæɡəˈziːn/'),
    'nemt': ('next', '紧接着；随后', '/nekst/'),
    'names very': None,
    'adv.': None,
    'dr =doctor': ('Dr', '医生；博士', '/ˈdɒktə(r)/'),
    'x-ray x': ('X-ray', 'X 光', '/ˈeks reɪ/'),
    'hurt) idea': ('idea', '想法；主意', '/aɪˈdɪə/'),
    'group 5': None,
    'class 3': None,
    'ms chen': None,
    'these rulers': None,
    'those crayons': None,
    'watermelons': ('watermelon', '西瓜', '/ˈwɔːtəmelən/'),
    'ducks': ('duck', '鸭子', '/dʌk/'),
    'pigs': ('pig', '猪', '/pɪɡ/'),
    'cows': ('cow', '母牛；奶牛', '/kaʊ/'),
    'parents': ('parent', '父亲；母亲', '/ˈpeərənt/'),
    'cheaper': ('cheap', '更便宜的', '/tʃiːp/'),
    'hotter': ('hot', '更热的', '/hɒt/'),
    'prettier': ('pretty', '更漂亮的', '/ˈprɪti/'),
    'someone': ('someone', '某人', '/ˈsʌmwʌn/'),
    'women': ('women', '女人（复数）', '/ˈwɪmɪn/'),
    'let’s': ('let’s', '让我们', '/lets/'),
    'kung fu': ('kung fu', '功夫', '/ˌkʊŋ ˈfuː/'),
    'o’clock': ('o’clock', '……点钟', '/əˈklɒk/'),
    'spacewoman': ('spacewoman', '女宇航员', '/ˈspeɪsˌwʊmən/'),
    'grassland': ('grassland', '草原；草地', '/ˈɡrɑːslænd/'),
    'bookshop': ('bookshop', '书店', '/ˈbʊkʃɒp/'),
    'theatre': ('theatre', '剧院', '/ˈθɪətə(r)/'),
    'teamwork': ('teamwork', '团队合作', '/ˈtiːmwɜːk/'),
    'pupil': ('pupil', '小学生', '/ˈpjuːpl/'),
    'soldier': ('soldier', '军人；士兵', '/ˈsəʊldʒə(r)/'),
    'seventh': ('seventh', '第七', '/ˈsevnθ/'),
    'stripe': ('stripe', '条纹；线条', '/straɪp/'),
    'pitter-patter': ('pitter-patter', '（雨声）啪嗒啪嗒', '/ˈpɪtə pætə(r)/'),
    'e-friend': ('e-friend', '网友', '/ˈiː frend/'),
    'ps': ('PS', '附言', '/ˌpiː ˈes/'),
    'before meals': ('before meals', '饭前', '/bɪˈfɔː miːlz/'),
    'after meals': ('after meals', '饭后', '/ˈɑːftə miːlz/'),
    'brush one’s teeth': ('brush one’s teeth', '刷牙', '/brʌʃ wʌnz tiːθ/'),
    'do taijiquan': ('do taijiquan', '打太极拳', '/duː ˌtaɪˈdʒiː tʃwɑːn/'),
    'beijing opera': ('Beijing opera', '京剧', '/ˌbeɪdʒɪŋ ˈɒprə/'),
    'beijing roast duck': ('Beijing roast duck', '北京烤鸭', '/ˌbeɪdʒɪŋ ˈrəʊst dʌk/'),
    'tian’anmen square': ('Tian’anmen Square', '天安门广场', '/tjenˈɑːnmən skweə(r)/'),
    'buckingham palace': ('Buckingham Palace', '白金汉宫', '/ˈbʌkɪŋəm ˈpæləs/'),
    'niagara falls': ('Niagara Falls', '尼亚加拉瀑布', '/naɪˈæɡərə fɔːlz/'),
    'cn tower': ('CN Tower', '加拿大国家电视塔', '/ˌsiː ˈen ˈtaʊə(r)/'),
    'children’s day': ('Children’s Day', '儿童节', '/ˈtʃɪldrənz deɪ/'),
}

PROPER = {
    'australia': '/ɒˈstreɪliə/', 'canberra': '/ˈkænbərə/', 'ottawa': '/ˈɒtəwə/',
    'russia': '/ˈrʌʃə/', 'april': '/ˈeɪprəl/', 'july': '/dʒuˈlaɪ/',
    'america': '/əˈmerɪkə/', 'american': '/əˈmerɪkən/', 'australian': '/ɒˈstreɪliən/',
    'newyork': '/ˌnjuː ˈjɔːk/', 'santa': '/ˈsæntə/',
    'mike': '/maɪk/', 'mary': '/ˈmeəri/', 'maddy': '/ˈmædi/', 'billy': '/ˈbɪli/',
    'benny': '/ˈbeni/', 'tess': '/tes/', 'zeke': '/ziːk/', 'bob': '/bɒb/',
    'al': '/æl/', 'anna': '/ˈænə/', 'becky': '/ˈbeki/', 'john': '/dʒɒn/',
    'marshall': '/ˈmɑːʃəl/', 'neva': '/ˈnevə/', 'oba': '/ˈəʊbə/', 'sam': '/sæm/',
    'scott': '/skɒt/', 'helen': '/ˈhelən/', 'karla': '/ˈkɑːlə/', 'keller': '/ˈkelə(r)/',
    'krista': '/ˈkrɪstə/', 'kylie': '/ˈkaɪli/', 'pele': '/ˈpeleɪ/', 'sullivan': '/ˈsʌlɪvən/',
}


def fix_head(w):
    w = ''.join(LIG.get(c, c) for c in w).strip()
    if w.startswith(')'):
        return w[1:].strip()
    if '(' in w:
        return w.split('(')[0].strip()
    if ')' in w:
        if ' ' in w:
            return w.split(' ')[0].strip()
        return w.split(')')[0].strip()
    return w


def run():
    tot = 0
    for f in sorted(glob.glob(os.path.join(HERE, '*.words.json'))):
        d = json.load(open(f, encoding='utf-8'))
        out = []
        for w in d['words']:
            raw = ''.join(LIG.get(c, c) for c in w['word']).strip()
            k = raw.lower()
            if k in FIX:
                v = FIX[k]
                if v is None:
                    continue
                nw, ng, ni = v
                w['word'], w['gloss'] = nw, ng
                if ni:
                    w['ipaUK'] = ni
            else:
                w['word'] = fix_head(raw)
                if not w['word']:
                    continue
                w['gloss'] = ''.join(LIG.get(c, c) for c in w.get('gloss', ''))
                lk = w['word'].lower()
                if not w.get('ipaUK') and lk in PROPER:
                    w['ipaUK'] = PROPER[lk]
            out.append(w)
        d['words'] = out
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        tot += len(out)
    print('修正后总词数', tot)


if __name__ == '__main__':
    run()
