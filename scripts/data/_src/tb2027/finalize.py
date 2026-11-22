# -*- coding: utf-8 -*-
"""6 册（三下）词表定稿：人工复核修正 → {book}.final.json

复核依据：对照 PDF 原文逐条看词形、音标、释义。
修正三类问题：
  1. 词形被 PDF 文本层拆断（'be befo fore re bed' → 'before bed'）
  2. 释义串行（右侧广告/页脚文字混进来：'做；干狗' → '做；干'）
  3. 不是词条的东西（'It's ...' 句型、'Numbers' 栏目标题、'Group 5'）
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))

# key(小写原词) -> (新词形 or None, 新释义 or None, 新音标 or None)
FIX = {
    # ---------------- 辽师大 三下 ----------------
    'ls-3b': {
        'be befo fore re bed': ('before bed', '睡前', '/bɪˈfɔː bed/'),
        'bef efore ore': ('before', '在……之前', '/bɪˈfɔː(r)/'),
        'colo colour ur ame color)': ('colour', '颜色', '/ˈkʌlə(r)/'),
        'old': (None, '老的；……岁的', None),
        'bookshop': (None, '书店', '/ˈbʊkʃɒp/'),
        'rose': (None, '玫瑰', '/rəʊz/'),
        'crayon': (None, '蜡笔', '/ˈkreɪən/'),
        'anyone': (None, '任何人', '/ˈeniwʌn/'),
    },
    # ---------------- 湘少 三下 ----------------
    'xs-3b': {
        'cap': (None, '（有帽舌的）帽子', None),
        "o’clock": (None, '……点钟', '/əˈklɒk/'),
        'wake up': (None, '醒来', '/ˈweɪk ʌp/'),
        'eighteen': (None, '十八', '/ˌeɪˈtiːn/'),
        'nineteen': (None, '十九', '/ˌnaɪnˈtiːn/'),
        'seventeen': (None, '十七', '/ˌsevnˈtiːn/'),
        'sixteen': (None, '十六', '/ˌsɪksˈtiːn/'),
        'strawberry': (None, '草莓', '/ˈstrɔːbəri/'),
        'tooth': (None, '牙齿', '/tuːθ/'),
    },
    # ---------------- 清华 三下 ----------------
    'qh-3b': {
        'clean up': (None, '打扫干净', None),
        'fast': (None, '快的；迅速地', None),
        'favorite': (None, '最喜欢的', '/ˈfeɪvərɪt/'),
        'sure': (None, '一定的；当然', None),
        'chinese': (None, '中文；中国人', None),
        'feel': (None, '感觉', None),
        'subject': (None, '科目，课程', None),
        'dirty': (None, '脏的', None),
        'hour': (None, '小时', None),
        'into': (None, '到……里面', None),
        "o’clock": (None, '……点钟', '/əˈklɒk/'),
        'turn': (None, '转动；轮流', None),
        'wake up': (None, '醒来', '/ˈweɪk ʌp/'),
        'wake': (None, '醒', '/weɪk/'),
        'child (': ('child', '孩子', '/tʃaɪld/'),
        'make (': ('make', '制作', '/meɪk/'),
        'drink': (None, '喝；饮料', None),
        'color': (None, '颜色；涂颜色', '/ˈkʌlə(r)/'),
        'math': (None, '数学', '/mæθ/'),
        'semester': (None, '学期', '/sɪˈmestə(r)/'),
        'textbook': (None, '课本', '/ˈtekstbʊk/'),
        'boat': (None, '小船', '/bəʊt/'),
        'line': (None, '线；排；行', '/laɪn/'),
        'holder': (None, '容器', '/ˈhəʊldə(r)/'),
        'light': (None, '灯；明亮的', '/laɪt/'),
        'dark': (None, '黑的，暗的', '/dɑːk/'),
        'sleep': (None, '睡觉', '/sliːp/'),
        'trash': (None, '垃圾', '/træʃ/'),
        'messy': (None, '凌乱的', '/ˈmesi/'),
        'row': (None, '划（船）', '/rəʊ/'),
        'vote': (None, '投票', '/vəʊt/'),
        'grow': (None, '生长，种植', '/ɡrəʊ/'),
        'stand in line': (None, '排队', '/stænd ɪn laɪn/'),
        'trash can': (None, '垃圾箱', '/træʃ kæn/'),
    },
    # ---------------- 冀教 三下 ----------------
    'jj-3b': {
        'do': (None, '做；干', None),
        'homework': (None, '家庭作业', None),
        'place': (None, '位置；地点', None),
        'sheep': (None, '绵羊', None),
        'leaf': (None, '叶子', None),
        'swim': (None, '游泳', None),
        'old': (None, '老的；相识久的', None),
        'wash up': (None, '洗刷餐具', None),
        'favourite': (None, '最喜爱的', None),
        'then': (None, '然后', '/ðen/'),
        'timetable': (None, '时间表', '/ˈtaɪmteɪbl/'),
        'giant': ('giant', '巨大的', '/ˈdʒaɪənt/'),
        'tooth': ('tooth', '牙齿', '/tuːθ/'),
        'baker': (None, '面包师傅', '/ˈbeɪkə(r)/'),
        'bacon': (None, '培根，熏猪肉', '/ˈbeɪkən/'),
        'bath': (None, '洗澡', '/bɑːθ/'),
        'beijing roast duck': (None, '北京烤鸭', '/ˌbeɪdʒɪŋ rəʊst ˈdʌk/'),
        'cereal': (None, '谷类食物', '/ˈsɪəriəl/'),
        'chick': (None, '小鸡', '/tʃɪk/'),
        'dairy': (None, '乳制品', '/ˈdeəri/'),
        'diet': (None, '日常饮食', '/ˈdaɪət/'),
        'dream': (None, '梦', '/driːm/'),
        'duckling': (None, '小鸭', '/ˈdʌklɪŋ/'),
        'eighteen': (None, '十八', '/ˌeɪˈtiːn/'),
        'fat': (None, '胖的', '/fæt/'),
        'flour': (None, '面粉', '/ˈflaʊə(r)/'),
        'grain': (None, '谷物', '/ɡreɪn/'),
        'grapefruit': (None, '柚子', '/ˈɡreɪpfruːt/'),
        'grassland': (None, '草原', '/ˈɡrɑːslænd/'),
        'housework': (None, '家务', '/ˈhaʊswɜːk/'),
        'lay': (None, '下（蛋）', '/leɪ/'),
        'mess': (None, '杂乱', '/mes/'),
        'nineteen': (None, '十九', '/ˌnaɪnˈtiːn/'),
        'pancake': (None, '烙饼', '/ˈpænkeɪk/'),
        'rise': (None, '起床；起立', '/raɪz/'),
        'roar': (None, '吼叫；咆哮', '/rɔː(r)/'),
        'salt': (None, '盐', '/sɔːlt/'),
        'seventeen': (None, '十七', '/ˌsevnˈtiːn/'),
        'sixteen': (None, '十六', '/ˌsɪksˈtiːn/'),
        'sleep': (None, '睡觉', '/sliːp/'),
        'soft': (None, '软的', '/sɒft/'),
        'wolf': (None, '狼', '/wʊlf/'),
        'yummy': (None, '很好吃的', '/ˈjʌmi/'),
        'crayon': (None, '蜡笔', '/ˈkreɪən/'),
    },
    # ---------------- 沪教 三下 ----------------
    'hj-3b': {
        'sweater': (None, '毛衣', None),
        'sports ground': (None, '操场', None),
        'out': (None, '在室外', '/aʊt/'),
        'look out of': (None, '向……外看', '/lʊk aʊt ɒv/'),
        'there (is, are)': ('there', '有；存在', '/ðeə(r)/'),
        'up': (None, '向上；在上面', None),
        'basketball court': (None, '篮球场', '/ˈbɑːskɪtbɔːl kɔːt/'),
        'play ping-pong': (None, '打乒乓球', '/pleɪ ˈpɪŋpɒŋ/'),
        'row a boat': (None, '划船', '/rəʊ ə bəʊt/'),
        'sand': (None, '沙子', '/sænd/'),
        'sandcastle': (None, '沙堡', '/ˈsændkɑːsl/'),
        'of course': (None, '当然', '/əv ˈkɔːs/'),
        'shoes': (None, '鞋子', '/ʃuːz/'),
        'uniform': (None, '制服；校服', '/ˈjuːnɪfɔːm/'),
        'buzz': (None, '（蜜蜂）嗡嗡声', '/bʌz/'),
        'chirp': (None, '（鸟）叽叽喳喳', '/tʃɜːp/'),
        'lake': (None, '湖', '/leɪk/'),
        'path': (None, '小路', '/pɑːθ/'),
        'pitter-patter': (None, '（雨）淅沥声', '/ˈpɪtə pætə(r)/'),
        'quack': (None, '（鸭子）嘎嘎声', '/kwæk/'),
        'swish': (None, '（风）嗖嗖声', '/swɪʃ/'),
        'dark': (None, '黑暗的；昏暗的', '/dɑːk/'),
        'lizard': (None, '蜥蜴', '/ˈlɪzəd/'),
        'boat': (None, '小船', '/bəʊt/'),
        'teddy bear': (None, '泰迪熊', '/ˈtedi beə(r)/'),
        'window': (None, '窗户', '/ˈwɪndəʊ/'),
        "children’s day": (None, '儿童节', '/ˈtʃɪldrənz deɪ/'),
        'eighteen': (None, '十八', '/ˌeɪˈtiːn/'),
        'nineteen': (None, '十九', '/ˌnaɪnˈtiːn/'),
        'seventeen': (None, '十七', '/ˌsevnˈtiːn/'),
        'sixteen': (None, '十六', '/ˌsɪksˈtiːn/'),
        'pizza': (None, '比萨饼', '/ˈpiːtsə/'),
        'show ... around ...': None,   # 带占位符，不是词条
        'numbers': None,               # 栏目标题
    },
    # ---------------- 川教 三下 ----------------
    'cj-3b': {
        # 带 … 的句型与整句，全部剔除（例句另走 sentences 通道）
        "it’s ...": None,
        'one more ... there.': None,
        "they’re ...": None,
        'yes, you’re right.': None,
        'a song about ...': None,
        'i like ...': None,
        'i think ...': None,
        'me too.': None,
        'come and look at ...': None,
        'they look ...': None,
        'this is my ...': None,
        "i’m someone’s ...": None,
        'keep ... safe': None,
        'please guess.': None,
        'thanks.': None,
        "you’re great.": None,
        "you’re right.": None,
        'a birthday card for you.': None,
        'make ... together': None,
        'say cheese': None,
        'here you are.': None,
        'i have ...': None,
        'many thanks.': None,
        'there are ...': None,
        "that’s ok.": None,
        "you’re so kind.": None,
        "you’re welcome.": None,
        'be quiet, please.': None,
        'come with me.': None,
        "let’s take a look.": None,
        'so many ...': None,
        'there is ... in my school.': None,
        'be good at ...': None,
        'group 5': None,
        'sunshine primary school': None,
        'chant': None,
        'observe': None,
        'finding': None,
        'step': None,
        'had': (None, '有（过去式）', '/hæd/'),
        'men': (None, '男人（复数）', '/men/'),
        'policeman': (None, '警察', None),
        'many animals': (None, '许多动物', '/ˈmeni ˈænɪmlz/'),
        'the animal care center': ('Animal Care Center', '动物照顾中心', '/ˈænɪml keə ˈsentə(r)/'),
        'all jobs': (None, '所有的工作', '/ɔːl dʒɒbz/'),
        'draw pictures': (None, '画画', '/drɔː ˈpɪktʃəz/'),
        'chick': (None, '小鸡', '/tʃɪk/'),
        'fat': (None, '肥的', '/fæt/'),
        'fish tank': (None, '鱼缸', '/fɪʃ tæŋk/'),
        'fisherman': (None, '渔夫', '/ˈfɪʃəmən/'),
        'teaching building': (None, '教学楼', '/ˈtiːtʃɪŋ ˈbɪldɪŋ/'),
        'have classes': (None, '上课', '/hæv ˈklɑːsɪz/'),
        'after-school activities': (None, '课外活动', '/ˈɑːftə skuːl ækˈtɪvətiz/'),
        'line up': (None, '排队', '/laɪn ʌp/'),
        'sure.': None,
        'thank you very much.': None,
        'in the same group': (None, '在同一组', '/ɪn ðə seɪm ɡruːp/'),
    },
}


def run():
    for book, fix in FIX.items():
        p = os.path.join(HERE, f'{book}.words.json')
        d = json.load(open(p, encoding='utf-8'))
        out, used = [], set()
        for w in d['words']:
            k = w['word'].lower()
            if w['unit'] == 0:
                continue                          # 定位不到单元的（页码落在目录/附录），一律不收
            if k in fix:
                used.add(k)
                v = fix[k]
                if v is None:
                    continue                      # 显式剔除
                nw, ng, ni = v
                if nw:
                    w['word'] = nw
                if ng:
                    w['gloss'] = ng
                if ni:
                    w['ipaUK'] = ni
            # 兜底清洗：去掉尾部页码、残留括号说明
            g = w.get('gloss', '')
            g = re.sub(r'\s*[（(]\s*\d+\s*[)）]\s*$', '', g)
            g = re.sub(r'\s+\d{1,3}\s*$', '', g)
            w['gloss'] = g.strip()
            if not w['word'].strip():
                continue
            out.append(w)
        miss = [k for k in fix if k not in used]
        # 去重（同单元同词形只留一条）
        seen, ded = set(), []
        for w in out:
            key = (w['unit'], w['word'].lower())
            if key in seen:
                continue
            seen.add(key)
            ded.append(w)
        d['words'] = ded
        json.dump(d, open(os.path.join(HERE, f'{book}.final.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print(f'{book}: {len(ded)} 词（未命中的修正键 {len(miss)}: {miss[:6]}）')


if __name__ == '__main__':
    run()
