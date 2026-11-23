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
    'hold onto the rope tightly.': {1: ('介词', '到……上'), 4: ('副词', '紧紧地')},
    'there was a fashion show at school.': {3: ('名词', '时装')},
    'i read an e-book on the tablet.': {6: ('名词', '平板')},

    # ---- 2026 秋新册造句精修 ----
    'take a deep breath and calm down.': {5: ('动词', '冷静'), 6: ('副词', '下来')},
    'sit down and calm down first.': {3: ('动词', '冷静'), 4: ('副词', '下来')},
    'each solar term has traditional food.': {1: ('形容词', '太阳的'), 2: ('名词', '节气')},
    'we take the high-speed train to shanghai.': {3: ('形容词', '高速的')},
    'the high-speed train is very fast.': {1: ('形容词', '高速的')},
    'the river thames runs through london.': {1: ('名词', '河'), 2: ('名词', '泰晤士')},
    'new delhi is the capital of india.': {1: ('名词', '德里')},
    'the taj mahal is in india.': {1: ('名词', '泰姬'), 2: ('名词', '陵墓')},
    'washington d.c. is the capital of the us.': {0: ('名词', '华盛顿'), 1: ('名词', '特区')},
    'one and five are odd numbers.': {4: ('形容词', '奇数的')},
    'two and four are even numbers.': {4: ('形容词', '偶数的')},
    'the cat eats by itself.': {4: ('代词', '它自己')},
    'water is a natural resource.': {4: ('名词', '资源')},
    'we should reduce natural resources waste.': {},
    'santa claus brings gifts at christmas.': {0: ('名词', '圣诞'), 1: ('名词', '老人')},
    'the shop opens at 9 a.m. and closes at 6 p.m.': {5: ('名词', '上午'), 10: ('名词', '下午')},
    'people clean tombs at tomb-sweeping day.': {4: ('名词', '扫墓'), 5: ('名词', '节日')},
    'rocks are non-living things.': {2: ('形容词', '无生命的')},
    'we visit our elders at the double ninth festival.': {3: ('名词', '长辈'), 6: ('形容词', '重阳'), 7: ('名词', '节')},
    'the kids clean the room by themselves.': {6: ('代词', '他们自己')},
    'i want a glass of milk.': {3: ('名词', '杯')},
    'a day has twenty-four hours.': {2: ('形容词', '二十四')},
    'there are twenty-eight students in class.': {2: ('形容词', '二十八')},
    'grandpa is sixty-eight years old.': {2: ('形容词', '六十八')},
    'the bow on her dress is pink.': {1: ('名词', '蝴蝶结')},
    'my uncle makes wine from grapes.': {3: ('名词', '葡萄酒')},
    'we should keep the public places clean.': {4: ('形容词', '公共的')},
    'the students mostly walk to school.': {2: ('副词', '大多')},
    'i like the indigo dress.': {3: ('形容词', '靛蓝色的')},
    'plastic bags are harmful to animals.': {3: ('形容词', '有害的')},
    'paper and glass are recyclable.': {4: ('形容词', '可回收的')},
    'his story shows great imagination.': {4: ('名词', '想象力')},
    'can you imagine life in space?': {2: ('动词', '想象')},
    'the little boy is very angry.': {4: ('副词', '非常')},
    'the weather gets worse today.': {3: ('形容词', '更糟的')},
    'mum is mad about the broken vase.': {3: ('形容词', '生气的')},
    'it might rain tomorrow.': {1: ('助动词', '可能')},
    'it takes at least ten minutes.': {3: ('副词', '至少')},
    'the book costs twenty yuan.': {2: ('动词', '花费')},
    'you seem happy today.': {2: ('动词', '似乎')},
    'give me a chance, please.': {3: ('名词', '机会')},
    'reading is a useful skill.': {4: ('名词', '技能')},
    'there is a book fair at school.': {4: ('名词', '集市')},
    'she gives good advice.': {3: ('名词', '建议')},
    'my teacher gives me good advice.': {4: ('名词', '建议')},
    'besides english, we learn maths.': {0: ('介词', '除了')},
    'thank you for your understanding.': {4: ('名词', '理解')},
    'the temperature is below zero.': {3: ('介词', '低于')},
    'please record your reading.': {1: ('动词', '录制')},
    'the first step is to wash the rice.': {3: ('名词', '步骤')},
    'please boil the water.': {1: ('动词', '煮沸')},
    'walk forward and turn left.': {1: ('副词', '向前')},
    'i search for information online.': {1: ('动词', '搜索')},
    'she gives everyone a warm greeting.': {5: ('名词', '问候')},
    'the girl is too shy to sing.': {4: ('形容词', '害羞的')},
    'we have a family reunion at spring festival.': {4: ('名词', '团聚')},
    'we help the elderly people.': {2: ('形容词', '年老的')},
    'the kids play with clay.': {4: ('名词', '黏土')},
    'i receive a letter from my friend.': {1: ('动词', '收到')},
    'we greet our teacher every morning.': {1: ('动词', '问候')},
    'the little bird hurt its wing.': {5: ('名词', '翅膀')},
    'look! a rainbow is in the sky.': {3: ('名词', '彩虹')},
    "what's for dessert today?": {3: ('名词', '甜点')},
    'i like eating meatballs with rice.': {3: ('名词', '肉丸')},
    'we had steak for dinner.': {2: ('名词', '牛排')},
    'can you guess this riddle?': {4: ('名词', '谜语')},
    'pigsy is funny in the story.': {0: ('名词', '猪八戒')},
    'grandpa practises calligraphy every day.': {2: ('动词', '练习'), 3: ('名词', '书法')},
    'the boys play rugby after school.': {3: ('名词', '橄榄球')},
    'we watch ice hockey games in winter.': {3: ('名词', '冰球')},
    'we go skiing in the mountains.': {2: ('动词', '滑雪')},
    'i want a double room, not a single one.': {3: ('形容词', '双人的'), 7: ('形容词', '单人的')},
    'we draw a family tree in class.': {4: ('名词', '家谱')},
    'dad has a new haircut.': {4: ('名词', '理发')},
    'he can ride a skateboard.': {4: ('名词', '滑板')},
    'there are all kinds of books here.': {3: ('名词', '种类')},
    'an eagle flies high in the sky.': {1: ('名词', '老鹰')},
    'the honeybee makes honey.': {1: ('名词', '蜜蜂')},
    'the bird makes a nest in the tree.': {4: ('名词', '巢')},
    'a little mouse lives in the tree hole.': {6: ('名词', '树洞')},
    'bees live in a hive.': {4: ('名词', '蜂巢')},
    'two plus three is five.': {2: ('介词', '加')},
    'ten minus four is six.': {2: ('介词', '减')},
    'mum buys a bag of rice.': {4: ('名词', '袋')},
    'i drink a bottle of juice.': {3: ('名词', '瓶')},
    'she gives me a bar of chocolate.': {5: ('名词', '块')},
    'wait for the green light.': {5: ('名词', '灯')},
    'we take a boat in venice.': {5: ('名词', '威尼斯')},
    'the wind comes from the northwest.': {5: ('名词', '西北')},
    'we eat fish and chips on friday.': {3: ('名词', '炸鱼薯条')},
    'we climb up the old pagoda.': {5: ('名词', '塔')},
    'they live in a cave house.': {5: ('名词', '窑洞')},
    'the deep-fried cake smells good.': {1: ('形容词', '油炸的')},
    'plants get sunlight through the window.': {2: ('动词', '获取'), 3: ('名词', '阳光')},
    'animals get food and water from nature.': {2: ('动词', '获取')},
    'the kids clean the room by themselves.': {6: ('代词', '他们自己')},
    'the cat eats by itself.': {4: ('代词', '它自己')},
    'we should reduce waste.': {3: ('动词', '减少')},
    'rice is the main food here.': {3: ('形容词', '主要的')},
    'we visit relatives at spring festival.': {2: ('动词', '拜访'), 3: ('名词', '亲戚')},
    'we have a dragon boat race on the river.': {4: ('名词', '龙舟')},
    'we watch lanterns at night.': {2: ('动词', '观赏'), 3: ('名词', '花灯')},
    'we will move next month.': {3: ('形容词', '下一个'), 4: ('名词', '月')},
    'we make jiaozi together.': {2: ('动词', '包'), 3: ('名词', '饺子')},
    "the family has a big meal on new year's eve.": {7: ('名词', '除夕')},
    'i feel relaxed at home.': {2: ('动词', '感觉'), 3: ('形容词', '放松的')},
    'she is good at drawing.': {1: ('动词', '是')},
    'we have lessons from monday to friday.': {2: ('名词', '课')},
    'we go skating in winter.': {2: ('动词', '滑冰')},
    'they go climbing at weekends.': {2: ('动词', '爬山')},
    'i take notes in class.': {2: ('动词', '记录'), 3: ('名词', '笔记')},
    'she does well in the exam.': {2: ('副词', '好')},
    'i feel good after sports.': {2: ('动词', '感觉')},
    'keep to the right on the road.': {4: ('名词', '右侧')},
    'move the box out of the way.': {5: ('名词', '挡路')},
    'do it right now, please.': {3: ('副词', '立刻')},
    'i get along with my classmates.': {2: ('动词', '相处')},
    "on his way back, he met a friend.": {5: ('副词', '回去')},
    'there is a big difference between the two.': {4: ('名词', '不同')},
    'can you tell the difference?': {4: ('名词', '不同')},
    'friends should talk it out.': {3: ('动词', '谈')},
    'i have a new haircut for the party.': {3: ('形容词', '新的')},
    "don't fight with each other.": {1: ('动词', '争吵')},
    "don't yell and cry in the room.": {2: ('动词', '喊叫'), 4: ('动词', '哭')},
    'never shout bad words at others.': {2: ('动词', '喊'), 3: ('形容词', '坏的')},
    "don't throw things when you are angry.": {2: ('动词', '扔'), 3: ('名词', '东西')},
    'count to ten before you speak.': {1: ('动词', '数')},
    "don't eat a lot before bed.": {3: ('名词', '很多')},
    'i listen to some music before sleep.': {2: ('动词', '听')},
    "don't yell out loud in the library.": {2: ('动词', '喊叫'), 4: ('形容词', '大声的')},
    'i talk with friends on the phone at night.': {2: ('动词', '交谈')},
    "let's solve the problem together.": {2: ('动词', '解决')},
    'the journey to beijing was long.': {1: ('名词', '旅程')},
    'we made the model by ourselves.': {5: ('代词', '我们自己')},
    'the hotel gives good service.': {4: ('名词', '服务')},
    'please sort the books by size.': {2: ('动词', '分类')},
    'the subway is very convenient.': {4: ('形容词', '方便的')},
    'canada is in north america.': {3: ('名词', '北美洲')},
    'people speak french in france.': {2: ('动词', '说'), 3: ('名词', '法语')},
    'we ride the big sky wheel at the park.': {5: ('名词', '摩天轮')},
    'rome is an old city in italy.': {0: ('名词', '罗马')},
    'the un helps countries work together.': {1: ('名词', '联合国')},
    'i get up early on weekdays.': {4: ('名词', '工作日')},
    'we go on an outing on saturday.': {4: ('名词', '郊游')},
    'we should get enough sleep.': {3: ('动词', '获取')},
    'drink a lot of water in summer.': {3: ('名词', '很多')},
    'we watch ice hockey games in winter.': {},
    'the taj mahal is in india.': {1: ('名词', '泰姬'), 2: ('名词', '陵墓')},

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
    # Sunny 在 cj 系列里是角色名（不是"晴朗的"）
    'i am sunny.': {2: ('名词', '桑尼')},
    'good evening, sunny!': {2: ('名词', '桑尼')},
    'sunny is the colour monster.': {0: ('名词', '桑尼')},
    "what may sunny's friends say to him now?": {2: ('名词', '桑尼')},
    # 姓氏复数作"一家人"（The Greens / The Wus）
    'the greens are my neighbours.': {1: ('名词', '格林一家')},
    'mr green is a writer, and mrs green is a teacher.': {1: ('名词', '格林'), 7: ('名词', '格林')},
    'the wus are my neighbours.': {1: ('名词', '吴一家')},
    'her name is candy.': {3: ('名词', '坎迪')},
    'his name is tiger.': {3: ('名词', '泰格')},
    'a-ma temple is the oldest temple in macao.': {0: ('名词', '妈阁')},
}


# 否定缩写词块（整块当一个词，中文给否定义）
NEG = {
    "don't": '不', "doesn't": '不', "didn't": '没有', "isn't": '不是',
    "aren't": '不是', "wasn't": '不是', "weren't": '不是', "can't": '不能',
    'cannot': '不能', "couldn't": '不能', "won't": '不会', "wouldn't": '不会',
    "shouldn't": '不应该', "haven't": '没有', "hasn't": '没有', "mustn't": '不可以',
}


def lookup(k, lex):
    """词形还原后查词：calling→call / says→say / brothers→brother / ming's→ming"""
    if not k:
        return None
    # 纯数字/时间（3 / 11:00 / 20）
    if re.fullmatch(r'[\d:.,]+', k):
        return ('数词', k)
    # 序数词 12th / 1st / 31st / 3rd / 2nd
    if re.fullmatch(r'\d+(st|nd|rd|th)', k):
        return ('数词', k)
    # 否定缩写：didn't / can't / isn't ...
    if k in NEG:
        return ('助动词', NEG[k])
    # 将来时缩写：I'll / he'll / we'll
    if k.endswith("'ll"):
        return ('助动词', '会')
    # 单个字母（字母教学句：the letter D / letter O）
    # 注意 a / I 这类本身就是单词，必须走词库，不能当成字母
    if len(k) == 1 and k.isalpha():
        if k in lex and lex[k]:
            return lex[k].most_common(1)[0][0]
        return ('名词', k.upper())
    # 班级代号 6A / 4B
    if re.fullmatch(r'\d+[a-z]', k):
        return ('名词', k.upper())
    # 连字符合成词：tree-planting / T-shirt / yel-low（逐段查，都能查到才认）
    if re.search(r'[-\u2014\u2013]', k):
        segs = [s for s in re.split(r'[-\u2014\u2013]', k) if s]
        got = [lookup(s, lex) for s in segs]
        if segs and all(got):
            return (got[0][0], '-'.join(g[1] for g in got))
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
    if k.endswith('ing') and len(k) > 4:
        stem = k[:-3]
        cands += [stem, stem + 'e']
        if len(stem) > 2 and stem[-1] == stem[-2]:
            cands.append(stem[:-1])
    if k.endswith('ed') and len(k) > 3:
        stem = k[:-2]
        cands += [stem, stem + 'e', k[:-1]]
        if len(stem) > 2 and stem[-1] == stem[-2]:
            cands.append(stem[:-1])
    if k.endswith('er') and len(k) > 4:
        stem = k[:-2]
        cands += [stem, stem + 'e']
        if len(stem) > 2 and stem[-1] == stem[-2]:
            cands.append(stem[:-1])
    if k.endswith('est') and len(k) > 5:
        stem = k[:-3]
        cands += [stem, stem + 'e']
        if len(stem) > 2 and stem[-1] == stem[-2]:
            cands.append(stem[:-1])
    if k.endswith('es') and len(k) > 3:
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
