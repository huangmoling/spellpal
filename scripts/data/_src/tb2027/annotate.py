# -*- coding: utf-8 -*-
"""例句标注器：用历史 21 册已标注语料做词块词性/中文词典，自动标注新例句。

输入：{book}.sent.src.tsv   unit \t 英文 \t 中文
输出：scripts/data/sentences-{book}.tsv（5 列 TAB）
      并把没把握的词块打印出来，人工补 LEX 后重跑。
"""
import glob, json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SRC = os.path.join(ROOT, 'scripts', 'data')

POS_OK = {'名词', '动词', '形容词', '副词', '代词', '介词', '连词', '冠词', '数词',
          '感叹词', '助动词', '缩略', '情态动词', '量词', '限定词', '疑问词', '标点'}

# 历史语料没覆盖到的词块，人工补（逐条核过）
LEX = {
    'diet': ('名词', '饮食'), 'chicken': ('名词', '鸡肉'), 'flour': ('名词', '面粉'),
    'beijing': ('名词', '北京'), 'roast': ('形容词', '烤的'), 'choice': ('名词', '选择'),
    'wash': ('动词', '洗'), 'chick': ('名词', '小鸡'), 'hen': ('名词', '母鸡'),
    'giraffes': ('名词', '长颈鹿'), 'or': ('连词', '或者'), 'animal': ('名词', '动物'),
    'meals': ('名词', '餐'), 'meal': ('名词', '餐'),
    'picture': ('名词', '图片'), 'pictures': ('名词', '图片'), 'pencil-box': ('名词', '铅笔盒'),
    'frog': ('名词', '青蛙'), 'sits': ('动词', '坐'), 'sit': ('动词', '坐'),
    'log': ('名词', '原木'), 'tank': ('名词', '缸'), 'but': ('连词', '但是'),
    'photo': ('名词', '照片'), 'photos': ('名词', '照片'), 'rose': ('名词', '罗斯'),
    'well': ('副词', '好'), 'yin': ('名词', '殷'), 'music': ('名词', '音乐'),
    'ready': ('形容词', '准备好的'), 'semester': ('名词', '学期'), 'trash': ('名词', '垃圾'),
    'row': ('动词', '划'), 'picnic': ('名词', '野餐'), 'mom': ('名词', '妈妈'),
    'throw': ('动词', '扔'), 'into': ('介词', '进入'),
    "there's": ('缩略', '有'), 'fun': ('名词', '乐趣'), 'feel': ('动词', '感觉'),
    'free': ('形容词', '自由自在的'), 'rowing': ('动词', '划'), 'great': ('形容词', '太好了'),
    'swims': ('动词', '游'), 'past': ('介词', '经过'), 'butterflies': ('名词', '蝴蝶'),
    'lizards': ('名词', '蜥蜴'), 'dogs': ('名词', '狗'), 'computer': ('名词', '电脑'),
    "children's": ('名词', '儿童的'), 'beach': ('名词', '海滩'),
    'kites': ('名词', '风筝'), 'nineteen': ('数词', '十九'), 'glad': ('形容词', '高兴的'),
    'wake': ('动词', '醒'), 'cindy': ('名词', '辛迪'), 'potatoes': ('名词', '土豆'),
    'potato': ('名词', '土豆'), 'strawberries': ('名词', '草莓'), 'party': ('名词', '聚会'),
    'games': ('名词', '游戏'), 'ship': ('名词', '轮船'), 'factory': ('名词', '工厂'),
    'woman': ('名词', '女人'), "i'd": ('缩略', '我想要'), 'ducks': ('名词', '鸭子'),
    'garden': ('名词', '花园'), 'cakes': ('名词', '蛋糕'),
}


# 上下文修正：句子（小写归一）→ {词块下标: (词性, 中文)}
CTX = {
    'i make my bed, too.': {4: ('副词', '也')},
    "i'd like a birthday cake, please.": {1: ('动词', '想要')},
    "i'd like a pencil case, please.": {1: ('动词', '想要'), 4: ('名词', '盒')},
    "let's open the gift.": {1: ('动词', '打开')},
    "let's have a rest.": {1: ('动词', '进行')},
    "what's the weather like today?": {3: ('介词', '像')},
    'my hair is clean.': {3: ('形容词', '干净的')},
    'we have a class party.': {3: ('名词', '班级')},
    'the woman is our teacher, too.': {5: ('副词', '也')},
    "we play games on children's day.": {5: ('名词', '节')},
    'i go to school by bus.': {5: ('名词', '公共汽车')},
    'there are three small potatoes.': {1: ('动词', '有')},
    'there is a big potato here.': {1: ('动词', '有')},
    'there are some strawberries.': {1: ('动词', '有')},
    'there are nineteen kites.': {1: ('动词', '有')},
    'turn off the light when it is light outside.':
        {1: ('动词', '关掉'), 4: ('连词', '当……时'), 7: ('形容词', '明亮的')},
    'can i turn on the light, mom?': {2: ('动词', '打开'), 3: ('副词', '打开')},
    'use old things to make new things.': {1: ('形容词', '旧的')},
    'i throw trash into the trash can.': {6: ('名词', '箱')},
    'please stand in line.': {3: ('名词', '队')},
    'i want to visit the science museum.': {3: ('动词', '参观')},
    "let's have a picnic in the park.": {1: ('动词', '进行')},
    'i tidy up and clean my room.': {1: ('动词', '整理')},
    'giraffes live in the forest or grassland.': {1: ('动词', '生活')},
    'i play basketball too.': {3: ('副词', '也')},
    "it's a hobby and fun to do.": {6: ('动词', '做')},
    'i wear a t-shirt, but i take a sweater.': {6: ('动词', '带')},
    'i wear a t-shirt and shorts to stay cool.': {7: ('动词', '保持')},
    'there are six red butterflies.': {2: ('数词', '六'), 3: ('形容词', '红色的')},
    'this is our art room.': {4: ('名词', '教室')},
    'the computer room is big.': {2: ('名词', '教室')},
    "i go to the park on children's day.": {7: ('名词', '节')},
    "it's black and white.": {1: ('形容词', '黑色的'), 3: ('形容词', '白色的')},
    'a frog sits on a big red box.': {6: ('形容词', '红色的')},
    'i like this dog, too.': {4: ('副词', '也')},
    "let's take a picture.": {1: ('动词', '拍'), 3: ('名词', '照片')},
    "let's take a look.": {1: ('动词', '做'), 3: ('名词', '看')},
    'thank you very much.': {3: ('副词', '多')},
    'i want to be a teacher.': {3: ('动词', '成为')},
}


def lookup(k, lex):
    """词形还原后查词：calling→call / says→say / brothers→brother / ming's→ming"""
    if not k:
        return None
    # 纯数字/时间（3 / 11:00 / 20）
    if re.fullmatch(r'[\d:.,]+', k):
        return ('数词', k)
    if k in lex and lex[k]:
        return lex[k].most_common(1)[0][0]
    # 所有格 / 缩写：susan's → susan, it's → it
    if k.endswith("'s") and len(k) > 3:
        base = k[:-2]
        if base in lex and lex[base]:
            pos, cn = lex[base].most_common(1)[0][0]
            return (pos, cn + '的')
    if k.endswith("s'") and len(k) > 3:
        base = k[:-2]
        if base in lex and lex[base]:
            pos, cn = lex[base].most_common(1)[0][0]
            return (pos, cn + '的')
    cands = []
    if k.endswith('ies') and len(k) > 4:
        cands.append(k[:-3] + 'y')
    if k.endswith('ied') and len(k) > 4:
        cands.append(k[:-3] + 'y')
    if k.endswith('ing') and len(k) > 5:
        stem = k[:-3]
        cands += [stem, stem + 'e']
        if len(stem) > 2 and stem[-1] == stem[-2]:
            cands.append(stem[:-1])
    if k.endswith('ed') and len(k) > 4:
        stem = k[:-2]
        cands += [stem, stem + 'e', k[:-1]]
        if len(stem) > 2 and stem[-1] == stem[-2]:
            cands.append(stem[:-1])
    if k.endswith('es') and len(k) > 4:
        cands += [k[:-2], k[:-1]]
    if k.endswith('s') and len(k) > 3:
        cands.append(k[:-1])
    for c in cands:
        if c in lex and lex[c]:
            return lex[c].most_common(1)[0][0]
    return None


def key(tok):
    t = tok.lower().replace('’', "'")
    t = re.sub(r"^[^a-z0-9']+|[^a-z0-9']+$", '', t)
    return t


def load_lex():
    lex = defaultdict(Counter)
    # 首选静态词库（由 build_lex.py 从功能词 + 单词表 + 历史语料提炼）
    p = os.path.join(HERE, 'token_lex.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            for k, v in json.load(f).items():
                lex[k][tuple(v)] += 1
        if lex:
            return lex
    # 兜底：扫已生成的例句文件（注意：清空例句时会失效）
    for f in glob.glob(os.path.join(SRC, 'sentences-*.tsv')):
        for ln in open(f, encoding='utf-8'):
            cols = ln.rstrip('\n').split('\t')
            if len(cols) < 5:
                continue
            en, poses, cns = cols[2], cols[3].split('|'), cols[4].split('|')
            parts = en.split()
            if len(parts) != len(poses) or len(parts) != len(cns):
                continue
            for p, pos, cn in zip(parts, poses, cns):
                k = key(p)
                if k and pos.strip() in POS_OK and cn.strip():
                    lex[k][(pos.strip(), cn.strip())] += 1
    return lex


def main(books):
    lex = load_lex()
    for b in books:
        p = os.path.join(HERE, f'{b}.sent.src.tsv')
        if not os.path.exists(p):
            print(f'· {b}: 没有 {b}.sent.src.tsv，跳过')
            continue
        rows, unknown = [], Counter()
        for ln in open(p, encoding='utf-8'):
            ln = ln.rstrip('\n')
            if not ln.strip() or ln.startswith('#'):
                continue
            unit, en, cn = ln.split('\t')[:3]
            parts = en.split()
            over = CTX.get(en.lower().replace('’', "'"), {})
            poses, cns = [], []
            for i, t in enumerate(parts):
                k = key(t)
                if not k:
                    # 纯标点 token（— / – 等）
                    poses.append('标点')
                    cns.append(t)
                    continue
                if i in over:
                    pos, c = over[i]
                elif k and lookup(k, lex):
                    pos, c = lookup(k, lex)
                elif k in LEX:
                    pos, c = LEX[k]
                else:
                    pos, c = '?', '?'
                    unknown[k or t] += 1
                poses.append(pos)
                cns.append(c)
            rows.append((unit, cn, en, '|'.join(poses), '|'.join(cns)))
        out = os.path.join(SRC, f'sentences-{b}.tsv')
        with open(out, 'w', encoding='utf-8') as f:
            for r in rows:
                f.write('\t'.join(r) + '\n')
        miss = sum(1 for r in rows for x in r[3].split('|') if x == '?')
        print(f'{b}: {len(rows)} 句，未识别词块 {miss}')
        for k, n in unknown.most_common():
            print(f'    {k} ×{n}')


if __name__ == '__main__':
    main(sys.argv[1:] or ['jj-3b', 'cj-3b', 'qh-3b', 'hj-3b', 'xs-3b', 'ls-3b'])
