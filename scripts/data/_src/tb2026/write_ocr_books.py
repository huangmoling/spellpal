# -*- coding: utf-8 -*-
"""把三本纯扫描册（教科五上 / 沪教五上 / 译林四上）的词汇表按视读结果落盘。

数据来源：三本 PDF 无文字层，用 PyMuPDF 150dpi 渲染后逐页视读，
条目、释义、单元归属、课本页码全部照抄课本 Word List 页，未作改写。
含 '…' 的短语和完整句子单列到 patterns，不混进单词表。
"""
import json
import os
import re

OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- 教科五上
JK = {
    'book': 'jk-五a',
    'title': '义务教育教科书·英语（教科版）五年级上册',
    'publisher': '教育科学出版社',
    'src_pages': 'P099–P102（课本 93–96 页）',
    'units': [
        ('Unit 1 Learn Words in Chunks', 1, [
            ('read', '朗读；阅读', None), ('loud', '大声的；喧闹的', None),
            ('sentence', '句子', None), ('anything', '任何事', None),
            ('fall', '掉落；秋天', None), ('something', '某事；某物', None),
            ('kid', '小孩', None), ('bedroom', '卧室', None),
            ('worry', '担心', None), ('few', '有些；很少', None),
            ('find', '找到；发现', None),
        ]),
        ('Unit 2 It\'s for Everybody', 2, [
            ('science', '科学', None), ('fair', '（活动）集市；公平的', None),
            ('skill', '技能', None), ('chance', '机会', None),
            ('become', '成为；变得', None), ('robot', '机器人', None),
            ('mind', '头脑', None), ('wear', '穿', None),
            ('advice', '建议', None), ('besides', '此外', None),
            ('interesting', '有趣的', None), ('seem', '似乎，好像', None),
            ('front', '前面；正面', None), ('win', '赢得；获胜', None),
        ]),
        ('Unit 3 Best Friends Forever', 3, [
            ('ill', '生病的', None), ('bad', '糟糕的；坏的', None),
            ('pet', '宠物', None), ('wrong', '错误的', None),
            ('miss', '想念；错过', None), ('hometown', '家乡', None),
            ('sad', '悲伤的；难过的', None), ('lose', '输掉', None),
            ('believe', '相信；认为', None), ('grade', '成绩；年级', None),
            ('difficult', '困难的', None), ('study', '学习', None),
            ('understanding', '理解', None), ('space', '空间；太空', None),
            ('hurt', '伤害；受伤', None), ('very', '非常', None),
        ]),
        ('Unit 4 Here Comes a Typhoon!', 4, [
            ('heavy', '严重的；沉的', None), ('bring', '带来', None),
            ('inside', '在里面', None), ('report', '报道', None),
            ('follow', '遵循；跟随', None), ('happen', '碰巧；发生', None),
            ('outside', '在外面', None), ('safe', '安全的', None),
            ('usually', '通常', None), ('land', '登陆；土地', None),
        ]),
        ('Unit 5 A Trip to Harbin', 5, [
            ('photo', '照片', None), ('ride', '旅途；骑', None),
            ('low', '低的', None), ('high', '高的', None),
            ('below', '低于；在……下面', None), ('degree', '度数', None),
            ('cap', '帽子', None), ('skirt', '裙子', None),
            ('shorts', '短裤', None), ('cloudy', '多云的', None),
            ('temperature', '温度', None), ('hat', '帽子', None),
            ('scarf', '围巾', None), ('sunny', '晴朗的', None),
            ('may', '可以；可能', None),
        ]),
        ('Unit 6 Space Travel', 6, [
            ('astronaut', '宇航员', None), ('farm', '农场', None),
            ('travel', '旅行', None), ('country', '国家', None),
            ('future', '将来的；未来', None), ('bag', '包；袋', None),
            ('moon', '月亮；月球', None), ('life', '生活；生命', None),
            ('Earth', '地球', None), ('hotel', '酒店', None),
        ]),
        ('Unit 7 Make a Bird Feeder', 7, [
            ('draw', '画', None), ('cut', '切；割', None),
            ('along', '沿着', None), ('feeder', '喂食器', None),
            ('bottle', '瓶子', None), ('plastic', '塑料的', None),
            ('hole', '洞', None), ('dry', '干燥的', None),
            ('windy', '多风的', None), ('glue', '粘合；胶水', None),
            ('plate', '盘子', None),
        ]),
        ('Review Let\'s Go Camping!', 8, [
            ('hike', '远足', None), ('hill', '小山', None),
            ('local', '当地的', None), ('camp', '露营', None),
            ('river', '河', None), ('forest', '森林', None),
            ('deep', '深的', None), ('bowl', '碗；盆', None),
            ('rope', '绳子', None), ('pen', '钢笔', None),
            ('glass', '玻璃', None),
        ]),
    ],
}

# ---------------------------------------------------------------- 沪教五上
HJ = {
    'book': 'hj-五a',
    'title': '义务教育教科书·英语（沪教牛津版）五年级上册',
    'publisher': '上海教育出版社',
    'src_pages': 'P103–P104（课本 102–103 页）',
    'units': [
        ('Unit 1', 1, [
            ('go jogging', '去慢跑', None), ('go fishing', '去钓鱼', None),
            ('do chores', '做家务', None), ('watch TV', '看电视', None),
            ('play with friends', '和朋友一起玩', None),
            ('have a picnic', '野餐', None), ('busy', '忙碌的', None),
            ('weekend', '周末', None), ('plan', '计划', None),
            ('early', '早的', None), ('catch', '抓住', None),
            ('any', '任何', None), ('robot', '机器人', None),
            ('sock', '袜子', None), ('sweep', '打扫；清扫', None),
            ('warm up', '热身', None),
            ('more ... than', '超过；比……更……', None),
        ]),
        ('Unit 2', 2, [
            ('do exercise', '做运动', None),
            ('eat healthy food', '吃健康的食物', None),
            ('drink a lot of water', '多喝水', None),
            ('get enough sleep', '保证充足的睡眠', None),
            ('strong', '强壮的', None), ('poster', '海报', None),
            ('about', '关于', None), ('habit', '习惯', None),
            ('junk food', '垃圾食品', None), ('must', '必须', None),
            ('less', '更少的', None), ('hard', '难的', None),
            ('try', '尝试', None), ('lie', '躺', None),
            ('ill', '生病的', None), ('a glass of', '一杯', None),
        ]),
        ('Unit 3', 3, [
            ('north', '北方', None), ('south', '南方', None),
            ('east', '东方', None), ('west', '西方', None),
            ('capital', '首都', None), ('museum', '博物馆', None),
            ('palace', '王宫；宫殿', None), ('tourist', '游客', None),
            ('visit', '参观；拜访', None), ('northwest', '西北', None),
            ('across', '穿过', None), ('fish and chips', '炸鱼薯条', None),
            ('popular', '流行的；受欢迎的', None), ('wine', '葡萄酒', None),
            ('on foot', '步行', None),
        ]),
        ('Unit 4', 4, [
            ('mountain', '山', None), ('cave', '洞穴', None),
            ('waterfall', '瀑布', None), ('hotel', '酒店', None),
            ('holiday', '假期', None), ('will', '将；将要', None),
            ('soon', '很快；马上', None),
            ('shall', '（表示将来的可能性）将', None),
            ('high-speed train', '高铁', None), ('explore', '探索', None),
            ('pagoda', '塔', None), ('stay', '待；暂住', None),
            ('cave house', '窑洞', None), ('famous', '著名的', None),
            ('deep-fried cake', '油炸糕', None),
            ('wonderful', '令人惊奇的；令人赞叹的', None),
            ('view', '景色；风景', None),
        ]),
        ('Unit 5', 5, [
            ('get sunlight', '获取阳光', None),
            ('get food and water', '获取食物和水', None),
            ('grow', '生长', None), ('change', '变化', None),
            ('move', '移动', None), ('living', '有生命的', None),
            ('non-living', '无生命的', None), ('thing', '东西', None),
            ('air', '空气', None),
            ('by themselves', '独自地；无需外力地', None),
            ('important', '重要的', None),
            ('by itself', '独自地；无需外力地', None),
            ('look around', '环顾', None),
        ]),
        ('Unit 6', 6, [
            ('smoke', '烟', None), ('dirty', '脏的', None),
            ('rubbish', '垃圾', None), ('recycle', '回收利用', None),
            ('reduce', '减少', None), ('natural resources', '自然资源', None),
            ('call', '把……叫做', None), ('wood', '木材', None),
            ('land', '土地', None), ('why', '为什么', None),
            ('clean', '干净的', None), ('hurt', '伤害', None),
            ('factory', '工厂', None), ('near', '在……附近', None),
            ('those', '那些', None), ('turn off', '关掉', None),
        ]),
        ('Unit 7', 7, [
            ('aunt', '阿姨；姑母；姨母；伯母；舅母；婶母', None),
            ('uncle', '舅父；叔父；伯父；姑父；姨父', None),
            ('together', '一起', None), ('celebrate', '庆祝', None),
            ('main', '主要的', None), ('eve', '前夕', None),
            ('stocking', '长筒袜', None),
            ('visit relatives', '拜访亲戚；探亲', None),
            ('eat mooncakes', '吃月饼', None),
            ('have a dragon boat race', '进行龙舟比赛', None),
            ('watch lanterns', '赏花灯', None), ('next month', '下个月', None),
            ('make jiaozi', '包饺子', None),
            ('watch a lion dance', '观看舞狮表演', None),
            ('have a big meal', '吃大餐', None),
            ('put up', '搭建；张贴；挂起', None),
        ]),
        ('Unit 8', 8, [
            ('fast', '快的', None), ('slow', '慢的', None),
            ('excited', '兴奋的', None), ('unhappy', '不开心的', None),
            ('feel', '觉得；感到', None), ('feeling', '感情；情绪', None),
            ('relaxed', '放松的', None), ('person', '人', None),
            ('imagination', '想象；想象力', None), ('imagine', '想象', None),
            ('all over the world', '世界各地', None),
        ]),
    ],
    'proper_nouns': [
        ('China', '中国', 26), ('France', '法国', 26), ('UK', '英国', 26),
        ('Paris', '巴黎', 26), ('the Eiffel Tower', '埃菲尔铁塔', 26),
        ('Big Ben', '大本钟', 26), ('Venice', '威尼斯', 27),
        ('Italy', '意大利', 27),
    ],
    'patterns_extra': [
        ('Me too.', '我也是。'),
        ('It sounds great.', '听起来很棒。'),
        ("I can't wait to go!", '我等不及要去了！'),
    ],
}

# ---------------------------------------------------------------- 译林四上
YL = {
    'book': 'yl-四a',
    'title': '义务教育教科书·英语（译林版）四年级上册',
    'publisher': '译林出版社',
    'src_pages': 'P080–P082（课本 78–80 页，Word lists I；P082 下半起为字母索引，未重复收录）',
    'units': [
        ('Unit 1', 1, [
            ('subject', '学科，科目', 8), ('Chinese', '语文（课）；中国的', 8),
            ('English', '英语（课）；英语的', 8), ('Maths', '数学（课）', 8),
            ('PE', '体育（课）', 8), ('Art', '美术（课）', 8),
            ('Science', '科学（课）', 8), ('IT', '信息科技（课）', 9),
            ('Music', '音乐（课）', 9), ('Labour', '劳动（课）', 9),
            ('best', '最，最高程度地', 10), ('also', '也', 10),
            ('mouse', '鼠标；老鼠', 10),
            ('be good at', '擅长', 13), ('interesting', '有趣的，有吸引力的', 13),
            ('learn about', '学习', 13), ('culture', '文化，文明', 13),
            ('read', '阅读', 13), ('story', '故事', 13),
            ('all', '全部，都', 13), ('sports ground', '操场，运动场', 13),
        ]),
        ('Unit 2', 2, [
            ('day', '一天，一日', 16), ('get up', '起床', 16),
            ('wash', '洗', 16), ('face', '脸，面孔', 16),
            ('have lessons', '上课', 16), ('have', '吃，喝', 16),
            ('dinner', '正餐（常指晚餐）', 16), ('breakfast', '早餐，早饭', 17),
            ('lunch', '午餐，午饭', 17), ('go to bed', '上床睡觉', 17),
            ('o\'clock', '（表示整点）……点钟', 18), ('thirty', '三十', 18),
            ('first', '首先，第一', 18), ('hurry up', '快点', 18),
            ('twenty', '二十', 18), ('Come on!', '赶快！加把劲！', 20),
            ('class', '课，上课', 20), ('eleven', '十一', 20),
            ('sport', '体育运动', 21), ('fifteen', '十五', 21),
            ('bed', '床', 21), ('Good night!', '晚安！', 21),
        ]),
        ('Unit 3', 3, [
            ('week', '周，星期', 24), ('Monday', '星期一', 24),
            ('Tuesday', '星期二', 24), ('Wednesday', '星期三', 24),
            ('Thursday', '星期四', 24), ('Friday', '星期五', 24),
            ('Saturday', '星期六', 24), ('Sunday', '星期天', 24),
            ('when', '什么时候', 26), ('every', '每一个，每个', 26),
            ('at', '在（某时间）', 26), ('up', '起床', 26),
            ('early', '提早，提前', 26), ('today', '在今天', 26),
            ('cinema', '电影院', 26), ('after school', '放学后', 28),
            ('dancing', '跳舞，舞蹈', 28), ('lesson', '一节课，一课时', 28),
            ('walk', '牵着（动物）走，遛', 29), ('dog', '狗', 29),
            ('tomorrow', '明天，在明天', 29), ('free', '空闲的', 29),
            ('See you tomorrow!', '明天见！', 29),
        ]),
        ('Unit 4', 4, [
            ('play', '打（球），踢（球）', 32), ('football', '足球运动；足球', 32),
            ('ping-pong', '乒乓球运动', 32),
            ('basketball', '篮球运动；篮球', 33), ('great', '非常的', 34),
            ('swimming', '游泳；游泳运动', 36),
            ('so', '（表示程度）这么，那么', 36), ('well', '好', 36),
            ('Have a go!', '试一试！', 36), ('hard', '难做的，不易的', 37),
            ('It\'s OK.', '没关系。', 37), ('try', '试', 37),
            ('Well played!', '好球！', 37),
        ]),
        ('Unit 5', 5, [
            ('different', '不同的，有区别的', 42), ('same', '相同的，同一的', 42),
            ('hair', '头发', 42), ('eye', '眼睛', 42),
            ('ear', '耳朵', 42), ('nose', '鼻子', 42),
            ('mouth', '嘴，口', 42), ('arm', '手臂', 42),
            ('leg', '腿', 42), ('robot', '机器人', 44),
            ('his', '他的', 44), ('tall', '高的', 44),
            ('short', '短的', 44), ('doll', '玩具娃娃', 46),
            ('her', '她的', 46), ('small', '小的', 47),
            ('bring', '带来', 47), ('lots of', '大量，许多', 47),
            ('have', '组织，举办', 47), ('show', '表演，演出', 47),
        ]),
        ('Unit 6', 6, [
            ('weather', '天气，气象', 50), ('cloudy', '多云的，阴天的', 50),
            ('sunny', '晴朗的', 50), ('cool', '凉的，凉爽的', 50),
            ('rainy', '阴雨的，多雨的', 50), ('hot', '温度高的，热的', 50),
            ('windy', '多风的，风大的', 50), ('warm', '温暖的，暖和的', 50),
            ('money', '钱', 52), ('park', '公园', 54),
            ('meet', '（与……）会面，集合', 54),
            ('fly a kite', '放风筝', 54),
            ('worry', '担心，担忧', 55), ('umbrella', '伞，雨伞', 55),
            ('there', '到那里，在那里', 55),
        ]),
        ('Unit 7', 7, [
            ('season', '季节', 58), ('spring', '春天，春季', 58),
            ('go boating', '去划船', 58), ('winter', '冬天，冬季', 58),
            ('go skating', '去溜冰，去滑冰', 59),
            ('summer', '夏天，夏季', 59), ('ice cream', '冰激凌', 59),
            ('go swimming', '去游泳', 59), ('autumn', '秋天，秋季', 60),
            ('go climbing', '去爬山', 60), ('new', '新的', 60),
            ('cold', '寒冷的，冷的', 60), ('bird', '鸟', 60),
            ('back', '回原处', 60), ('in', '在（某段时间）内', 62),
            ('year', '年', 62), ('plant', '栽种，种植', 62),
            ('pick', '采，摘', 62), ('snow', '雪，积雪', 63),
        ]),
        ('Unit 8', 8, [
            ('wear', '穿，戴', 66), ('cap', '（尤指有帽舌的）便帽', 66),
            ('coat', '外套，外衣', 66), ('skirt', '半身裙', 66),
            ('trousers', '裤子', 66), ('dress', '连衣裙', 66),
            ('shirt', '（男式）衬衫', 66), ('whose', '谁的', 68),
            ('shorts', '短裤', 68), ('look', '看来好像，显得', 68),
            ('in', '穿着，戴着', 68), ('sunglasses', '太阳镜，墨镜', 68),
            ('why', '为什么', 68), ('because', '因为', 68),
            ('bright', '聪明的；明亮的', 68), ('clothes', '衣服', 70),
        ]),
    ],
    'patterns_extra': [
        ("It's time for ...", '是……的时候了。'),
        ('It\'s time to ...', '到了……的时间了。'),
        ('Welcome back to ...', '欢迎回到……'),
        ('What time is it?', '几点了？'), ("I'm coming!", '我来了！'),
        ('What day is it today?', '今天星期几？'),
        ("What's the weather like today?", '今天天气怎么样？'),
        ("It's raining.", '下雨了。'),
        ('save ... for a rainy day', '未雨绸缪'),
    ],
}

SENT_TAIL = re.compile(r'[.?!]$')


def build(doc):
    words, patterns, n = [], [], 0
    for title, unit, rows in doc['units']:
        for w, g, page in rows:
            n += 1
            # 完整句子（首字母大写 + 句末标点）单列，不进单词表
            if SENT_TAIL.search(w) and w[0].isupper():
                patterns.append(dict(unit=unit, word=w, gloss=g, page=page))
                continue
            if '…' in w or '...' in w:
                patterns.append(dict(unit=unit, word=w, gloss=g, page=page))
                continue
            words.append(dict(unit=unit, word=w, gloss=g, page=page))
    for w, g in doc.get('patterns_extra', []):
        patterns.append(dict(unit=0, word=w, gloss=g, page=None))
    for w, g, p in doc.get('proper_nouns', []):
        words.append(dict(unit=0, word=w, gloss=g, page=p, proper=True))
    return dict(
        book=doc['book'], title=doc['title'], publisher=doc['publisher'],
        kind='ocr-visual', src_pages=doc['src_pages'],
        unitTitles={str(u): t for t, u, _ in doc['units']},
        check=dict(count=len(words), patterns=len(patterns)),
        words=words, patterns=patterns,
    )


if __name__ == '__main__':
    for doc in (JK, HJ, YL):
        d = build(doc)
        p = os.path.join(OUT, d['book'] + '.words.json')
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        per = {}
        for w in d['words']:
            per[w['unit']] = per.get(w['unit'], 0) + 1
        print(f"{d['book']:8s} {len(d['words']):4d} 词  句型 {len(d['patterns']):2d}  "
              f"单元分布 {dict(sorted(per.items()))}")
