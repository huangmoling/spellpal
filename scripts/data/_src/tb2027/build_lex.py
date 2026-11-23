# -*- coding: utf-8 -*-
"""从历史标注语料 + 单词表提炼稳定词库 token_lex.json

标注器不能从"待生成的文件"反推词典（清空即失效），
所以把 token → (词性, 中文) 的映射固化成静态资产。
"""
import glob, json, os, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SRC = os.path.join(ROOT, 'scripts', 'data')
BACKUP = os.path.join(ROOT, '.tmp', 'sentences-backup-0.18.1')

POS_OK = {'名词', '动词', '形容词', '副词', '代词', '介词', '连词', '冠词', '数词',
          '感叹词', '助动词', '缩略', '情态动词', '量词', '限定词', '疑问词', '标点'}


def key(tok):
    t = tok.lower().replace('’', "'")
    return re.sub(r"^[^a-z0-9'-]+|[^a-z0-9'-]+$", '', t)


# ---- 1) 功能词：义务教育阶段必考的高频虚词，逐条核定 ----
FUNC = {
    'a': ('冠词', '一个'), 'an': ('冠词', '一个'), 'the': ('冠词', '这'),
    'i': ('代词', '我'), 'you': ('代词', '你'), 'he': ('代词', '他'),
    'she': ('代词', '她'), 'it': ('代词', '它'), 'we': ('代词', '我们'),
    'they': ('代词', '他们'), 'me': ('代词', '我'), 'him': ('代词', '他'),
    'her': ('代词', '她'), 'us': ('代词', '我们'), 'them': ('代词', '他们'),
    'my': ('限定词', '我的'), 'your': ('限定词', '你的'), 'his': ('限定词', '他的'),
    'its': ('限定词', '它的'), 'our': ('限定词', '我们的'), 'their': ('限定词', '他们的'),
    'this': ('代词', '这个'), 'that': ('代词', '那个'), 'these': ('代词', '这些'),
    'those': ('代词', '那些'), 'there': ('副词', '那里'),
    'is': ('动词', '是'), 'am': ('动词', '是'), 'are': ('动词', '是'),
    'was': ('动词', '是'), 'were': ('动词', '是'), 'be': ('动词', '是'),
    'do': ('助动词', '做'), 'does': ('助动词', '做'), 'did': ('助动词', '做'),
    'have': ('动词', '有'), 'has': ('动词', '有'), 'had': ('动词', '有'),
    'can': ('情态动词', '能'), 'could': ('情态动词', '能'), 'may': ('情态动词', '可以'),
    'must': ('情态动词', '必须'), 'will': ('情态动词', '将会'),
    'would': ('情态动词', '将会'), 'should': ('情态动词', '应该'),
    'and': ('连词', '和'), 'or': ('连词', '或者'), 'but': ('连词', '但是'),
    'so': ('连词', '所以'), 'because': ('连词', '因为'), 'if': ('连词', '如果'),
    'when': ('连词', '当……时'), 'than': ('连词', '比'),
    'in': ('介词', '在……里'), 'on': ('介词', '在……上'), 'at': ('介词', '在'),
    'to': ('介词', '到'), 'for': ('介词', '为'), 'of': ('介词', '的'),
    'with': ('介词', '和……一起'), 'from': ('介词', '从'), 'by': ('介词', '乘'),
    'about': ('介词', '关于'), 'into': ('介词', '进入'), 'under': ('介词', '在……下'),
    'over': ('介词', '在……上方'), 'after': ('介词', '在……之后'),
    'before': ('介词', '在……之前'), 'near': ('介词', '在……附近'),
    'not': ('副词', '不'), 'no': ('副词', '不'), 'yes': ('副词', '是的'),
    'very': ('副词', '很'), 'too': ('副词', '也'), 'also': ('副词', '也'),
    'here': ('副词', '这里'), 'now': ('副词', '现在'), 'then': ('副词', '然后'),
    'up': ('副词', '向上'), 'down': ('副词', '向下'), 'out': ('副词', '向外'),
    'all': ('限定词', '全部'), 'some': ('限定词', '一些'), 'any': ('限定词', '任何'),
    'many': ('限定词', '许多'), 'much': ('限定词', '许多'), 'more': ('限定词', '更多'),
    'one': ('数词', '一'), 'two': ('数词', '二'), 'three': ('数词', '三'),
    'four': ('数词', '四'), 'five': ('数词', '五'), 'six': ('数词', '六'),
    'seven': ('数词', '七'), 'eight': ('数词', '八'), 'nine': ('数词', '九'),
    'ten': ('数词', '十'),
    'what': ('疑问词', '什么'), 'who': ('疑问词', '谁'), 'where': ('疑问词', '哪里'),
    'how': ('疑问词', '怎样'), 'why': ('疑问词', '为什么'), 'which': ('疑问词', '哪个'),
    "i'm": ('缩略', '我是'), "it's": ('缩略', '它是'), "what's": ('缩略', '是什么'),
    "let's": ('缩略', '让我们'), "that's": ('缩略', '那是'), "don't": ('缩略', '不'),
    "doesn't": ('缩略', '不'), "can't": ('缩略', '不能'), "isn't": ('缩略', '不是'),
    "aren't": ('缩略', '不是'), "i'd": ('缩略', '我想要'), "i'll": ('缩略', '我将'),
    "you're": ('缩略', '你是'), "we're": ('缩略', '我们是'), "they're": ('缩略', '他们是'),
    "he's": ('缩略', '他是'), "she's": ('缩略', '她是'), "there's": ('缩略', '有'),
    'mr': ('名词', '先生'), 'mrs': ('名词', '夫人'), 'ms': ('名词', '女士'),
    'ok': ('感叹词', '好'), 'oh': ('感叹词', '哦'), 'hi': ('感叹词', '嗨'),
    'hello': ('感叹词', '你好'),
    'helps': ('动词', '帮助'), 'help': ('动词', '帮助'),
    'days': ('名词', '天'), 'day': ('名词', '天'),
    'li': ('名词', '李'),
    'magical': ('形容词', '神奇的'), 'birdie': ('名词', '小鸟'),
}

# 教材里出现的人名/地名（音译），词块标注直接显示中文
PERSONS = {
    # 英文名
    'danny': '丹尼', 'jenny': '珍妮', 'peter': '彼得', 'smith': '史密斯',
    'david': '大卫', 'kitty': '基蒂', 'linda': '琳达', 'jim': '吉姆',
    'jane': '简', 'alice': '爱丽丝', 'lily': '莉莉', 'tim': '蒂姆',
    'jack': '杰克', 'tony': '托尼', 'anne': '安妮', 'joe': '乔',
    'fred': '弗雷德', 'steven': '史蒂文', 'lucas': '卢卡斯', 'tina': '蒂娜',
    'sara': '萨拉', 'lisa': '莉萨', 'jill': '吉尔', 'kim': '金',
    'bob': '鲍勃', 'tom': '汤姆', 'sam': '萨姆', 'rose': '罗斯',
    'betty': '贝蒂', 'tess': '特丝', 'sarah': '萨拉', 'sara': '萨拉', 'lynn': '林恩', 'lenny': '伦尼', 'ann': '安', 'qian': '钱', 'wangfujing': '王府井', 'karla': '卡拉', 'krista': '克里斯塔', 'zeke': '齐克', 'becky': '贝基', 'neva': '涅瓦', 'emma': '艾玛', 'steven': '史蒂文', 'mary': '玛丽', 'eddy': '埃迪',
    'billy': '比利', 'mark': '马克', 'taz': '塔兹', 'mulan': '木兰',
    'bobby': '博比', 'mike': '迈克', 'susan': '苏珊', 'jeff': '杰夫',
    'dachao': '大超', 'meiping': '美萍', 'wanrong': '万荣', 'zhiwei': '志伟',
    'jing': '静', 'betty': '贝蒂', 'helen': '海伦', 'henry': '亨利',
    'sally': '萨莉', 'daming': '大明', 'lingling': '玲玲', 'sam': '萨姆',
    'amy': '艾米', 'ben': '本', 'cindy': '辛迪', 'ellen': '埃伦',
    'grace': '格雷丝', 'kate': '凯特', 'lucy': '露西', 'nick': '尼克',
    'paul': '保罗', 'rita': '丽塔', 'sue': '休', 'tina': '蒂娜',
    # 中文人名拼音
    'ming': '明', 'wang': '王', 'liu': '刘', 'tao': '涛', 'lin': '林',
    'su': '苏', 'hua': '华', 'guo': '郭', 'hai': '海', 'ling': '玲',
    'yang': '杨', 'li': '李', 'zhang': '张', 'chen': '陈', 'zhou': '周',
    'wu': '吴', 'zhao': '赵', 'sun': '孙', 'ma': '马', 'hu': '胡',
    'tingting': '婷婷', 'lele': '乐乐', 'maomao': '毛毛', 'yangyang': '阳阳',
    'yiming': '一鸣', 'xiaoming': '小明', 'xiaohui': '小惠', 'qingqing': '庆庆',
    'wei': '伟', 'fang': '芳', 'ping': '平', 'hong': '红', 'yan': '燕',
    'jun': '军', 'lei': '磊', 'na': '娜', 'min': '敏', 'bo': '波',
    # 地名
    'hangzhou': '杭州', 'kunming': '昆明', 'hainan': '海南', 'sanya': '三亚',
    'beijing': '北京', 'shanghai': '上海', 'guangzhou': '广州', 'xian': '西安',
    'chengdu': '成都', 'nanjing': '南京', 'tianjin': '天津', 'london': '伦敦',
    'canada': '加拿大', 'australia': '澳大利亚', 'canberra': '堪培拉',
    'shijiazhuang': '石家庄', 'tazland': '塔兹兰', 'paris': '巴黎',
    'new york': '纽约', 'tokyo': '东京', 'china': '中国', 'england': '英国',
}

# ---- 2) 单词表：word → cnShort（最权威的释义来源）----
def load_wordbank():
    bank = {}
    for f in glob.glob(os.path.join(SRC, '*.tsv')):
        if os.path.basename(f).startswith('sentences-'):
            continue
        for ln in open(f, encoding='utf-8'):
            ln = ln.replace('\ufeff', '').rstrip('\n')
            if not ln.strip() or ln.startswith('#'):
                continue
            cols = ln.split('|')
            if len(cols) < 4:
                continue
            w, cn = cols[1].strip(), cols[3].strip()
            if not w or not cn:
                continue
            k = key(w)
            if k and k not in bank:
                bank[k] = cn
    return bank



# 不规则动词变形（said/went 等无法用屈折规则还原）
IRREG = {
    'said': 'say', 'says': 'say', 'went': 'go', 'gone': 'go', 'did': 'do', 'done': 'do',
    'had': 'have', 'was': 'be', 'were': 'be', 'been': 'be', 'saw': 'see', 'seen': 'see',
    'made': 'make', 'took': 'take', 'taken': 'take', 'came': 'come', 'got': 'get',
    'gotten': 'get', 'gave': 'give', 'given': 'give', 'told': 'tell', 'thought': 'think',
    'knew': 'know', 'known': 'know', 'found': 'find', 'ran': 'run', 'ate': 'eat',
    'eaten': 'eat', 'drank': 'drink', 'sang': 'sing', 'sung': 'sing', 'wrote': 'write',
    'written': 'write', 'bought': 'buy', 'brought': 'bring', 'taught': 'teach',
    'caught': 'catch', 'flew': 'fly', 'flown': 'fly', 'grew': 'grow', 'grown': 'grow',
    'drew': 'draw', 'drawn': 'draw', 'fell': 'fall', 'fallen': 'fall', 'felt': 'feel',
    'left': 'leave', 'met': 'meet', 'paid': 'pay', 'put': 'put', 'sent': 'send',
    'sat': 'sit', 'slept': 'sleep', 'spoke': 'speak', 'spoken': 'speak', 'stood': 'stand',
    'swam': 'swim', 'swum': 'swim', 'wore': 'wear', 'worn': 'wear', 'won': 'win',
    'lost': 'lose', 'held': 'hold', 'heard': 'hear', 'kept': 'keep', 'began': 'begin',
    'begun': 'begin', 'became': 'become', 'broke': 'break', 'broken': 'break',
    'built': 'build', 'chose': 'choose', 'chosen': 'choose', 'drove': 'drive',
    'driven': 'drive', 'fought': 'fight', 'flew': 'fly', 'forgot': 'forget',
    'forgotten': 'forget', 'hid': 'hide', 'hidden': 'hide', 'hit': 'hit', 'hurt': 'hurt',
    'lent': 'lend', 'meant': 'mean', 'rode': 'ride', 'ridden': 'ride', 'rose': 'rise',
    'risen': 'rise', 'said': 'say', 'sold': 'sell', 'spent': 'spend', 'spilt': 'spill',
    'spread': 'spread', 'stole': 'steal', 'stolen': 'steal', 'struck': 'strike',
    'swept': 'sweep', 'swore': 'swear', 'sworn': 'swear', 'threw': 'throw',
    'thrown': 'throw', 'understood': 'understand', 'woke': 'wake', 'woken': 'wake',
    'wound': 'wind', 'wrote': 'write',
}



# 教材里反复出现但单词表未收录的词（人工核定）
EXTRA = {
    'shelley': ('名词', '雪莉'), 'judy': ('名词', '朱迪'), 'emily': ('名词', '埃米莉'),
    'xiao': ('名词', '小'), 'hui': ('名词', '惠'), 'gang': ('名词', '刚'),
    'johnny': ('名词', '约翰尼'), 'hans': ('名词', '汉斯'), 'laura': ('名词', '劳拉'),
    'rita': ('名词', '丽塔'), 'reagan': ('名词', '里根'), 'ronald': ('名词', '罗纳德'),
    'keller': ('名词', '凯勒'), 'harbin': ('名词', '哈尔滨'), 'lhasa': ('名词', '拉萨'),
    'dalian': ('名词', '大连'), 'tai': ('名词', '泰山'), 'chinatown': ('名词', '唐人街'),
    'favorite': ('形容词', '最喜爱的'), 'favourite': ('形容词', '最喜爱的'),
    'popular': ('形容词', '受欢迎的'), 'journey': ('名词', '旅程'),
    'theme': ('名词', '主题'), 'college': ('名词', '学院'),
    'retired': ('形容词', '退休的'), 'neighbor': ('名词', '邻居'),
    'thief': ('名词', '小偷'), 'talent': ('名词', '才艺'),
    'twin': ('名词', '双胞胎'), 'seed': ('名词', '种子'),
    'butterfly': ('名词', '蝴蝶'), 'kangaroo': ('名词', '袋鼠'),
    'chat': ('动词', '聊天'), 'chatting': ('动词', '聊天'),
    'swallow': ('名词', '燕子'), 'proud': ('形容词', '自豪的'),
    'museum': ('名词', '博物馆'), 'subway': ('名词', '地铁'),
    'island': ('名词', '岛'), 'park': ('名词', '公园'),
    'offer': ('动词', '提供'), 'annie': ('名词', '安妮'), 'qiang': ('名词', '强'),
    'julia': ('名词', '朱莉娅'), 'shandong': ('名词', '山东'), 'liang': ('名词', '良'),
    'cao': ('名词', '曹'), 'chong': ('名词', '冲'),
    # 拼音名 / 童话角色 / 字母缩写（真句抽取中逐册发现后补入）
    'le': ('名词', '乐'), 'zhong': ('名词', '钟'), 'ting': ('名词', '婷'),
    'hui': ('名词', '惠'), 'hood': ('名词', '兜帽'),
    'abc': ('名词', 'ABC'),
    'qiu': ('名词', '秋'), 'rich': ('名词', '里奇'), 'dick': ('名词', '迪克'),
    'young': ('名词', '扬'),
    'tree-planting': ('名词', '植树'), 'planting': ('名词', '种植'),
    'duanwu': ('名词', '端午'),
    'muffin': ('名词', '松饼'), 'beg': ('动词', '恳求'), 'wise': ('形容词', '明智的'),
    'serve': ('动词', '服务'), 'serving': ('动词', '服务'), 'counter': ('名词', '柜台'),
    'jones': ('名词', '琼斯'), 'dongguo': ('名词', '东郭'),
    'white': ('名词', '怀特'), 'bell': ('名词', '贝尔'),
    'zero': ('数词', '零'),
    'mid-autumn': ('名词', '中秋'), 'york': ('名词', '约克'), 'mount': ('名词', '山峰'),
    "tian'anmen": ('名词', '天安门'), 'niagara': ('名词', '尼亚加拉'), 'cn': ('名词', '加拿大'),
    'pat': ('名词', '帕特'), 'xixi': ('名词', '西西'), 'meng': ('名词', '梦'),
    'kong': ('名词', '孔'), 'rong': ('名词', '融'), 'bill': ('名词', '比尔'),
    'yao': ('名词', '姚'), 'mira': ('名词', '米拉'), 'kai': ('名词', '凯'),
    'zhongshan': ('名词', '中山'), 'tiyu': ('名词', '体育'), 'maddy': ('名词', '玛迪'),
    'jimmy': ('名词', '吉米'), 'justin': ('名词', '贾斯廷'), 'nancy': ('名词', '南希'),
    'joy': ('名词', '乔伊'), 'charles': ('名词', '查尔斯'), 'elsa': ('名词', '埃尔莎'),
    'traditional': ('形容词', '传统的'), 'ancient': ('形容词', '古代的'),
    'george': ('名词', '乔治'), 'lu': ('名词', '鲁'), 'ban': ('名词', '班'),
    'wen': ('名词', '温'), 'grimm': ('名词', '格林'), 'german': ('形容词', '德国的'),
    'leo': ('名词', '利奥'), 'vincent': ('名词', '文森特'), 'gogh': ('名词', '高'),
    'aesop': ('名词', '伊索'), 'fables': ('名词', '寓言'), 'eve': ('名词', '前夜'),
    'rudolf': ('名词', '鲁道夫'), 'aiwen': ('名词', '艾文'), 'yafei': ('名词', '亚菲'),
    'ana': ('名词', '安娜'), 'lee': ('名词', '李'),
    'explain': ('动词', '解释'), 'advice': ('名词', '建议'),
    'piggy': ('名词', '小猪'), 'albert': ('名词', '阿尔伯特'), 'william': ('名词', '威廉'),
    'brandon': ('名词', '布兰登'), 'frank': ('名词', '弗兰克'), 'pump': ('名词', '彭普'),
    'cooks': ('名词', '库克斯'), 'candy': ('名词', '坎迪'),
    'pole': ('名词', '极'), 'jolly': ('名词', '乔利'), 'coke': ('名词', '可乐'),
    'sandy': ('名词', '桑迪'), 'jerry': ('名词', '杰里'), 'pierre': ('名词', '皮埃尔'),
    'nile': ('名词', '尼尔'), 'congo': ('名词', '刚果'),
    'yunnan': ('名词', '云南'), 'puppy': ('名词', '小狗'), 'yuanyuan': ('名词', '圆圆'),
    'cricket': ('名词', '蟋蟀'), 'alphabet': ('名词', '字母表'), 'jinshan': ('名词', '金山'),
    'astronaut': ('名词', '宇航员'),
    'luogeng': ('名词', '罗庚'), 'newton': ('名词', '牛顿'), 'mona': ('名词', '蒙娜'),
    'cathy': ('名词', '凯茜'), 'bit': ('名词', '比特'), 'da': ('名词', '达'),
    'vinci': ('名词', '芬奇'), 'nemo': ('名词', '尼莫'), 'isaac': ('名词', '艾萨克'),
    'thomas': ('名词', '托马斯'), 'edison': ('名词', '爱迪生'), 'einstein': ('名词', '爱因斯坦'),
    'leonardo': ('名词', '列奥纳多'), 'qi': ('名词', '齐'), 'baishi': ('名词', '白石'),
    'piper': ('名词', '派珀'), 'sullivan': ('名词', '沙利文'), 'brown': ('名词', '布朗'),
    'peck': ('名词', '配克'), 'pickled': ('形容词', '腌制的'), 'donkey': ('名词', '驴'),
    'mingming': ('名词', '明明'), 'longping': ('名词', '隆平'), 'binbin': ('名词', '彬彬'),
    'teddy': ('名词', '泰迪'), 'ducky': ('名词', '达基'), 'anne': ('名词', '安妮'),
    'fran': ('名词', '弗兰'), 'yu': ('名词', '愚'), 'gong': ('名词', '公'),
    'simon': ('名词', '西蒙'), 'bohai': ('名词', '渤海'), 'jake': ('名词', '杰克'),
    'international': ('形容词', '国际的'), 'kurt': ('名词', '库尔特'),
    'dongdong': ('名词', '东东'), 'charlie': ('名词', '查理'), 'mervin': ('名词', '默文'),
    'xiaoxiao': ('名词', '晓晓'), 'changsha': ('名词', '长沙'), 'rocket': ('名词', '火箭'),
    'spaceman': ('名词', '太空人'), 'jie': ('名词', '杰'), 'eric': ('名词', '埃里克'),
    'kelly': ('名词', '凯莉'), 'frightening': ('形容词', '吓人的'),
    'frighten': ('动词', '使害怕'), 'eiffel': ('名词', '埃菲尔'), 'ruby': ('名词', '鲁比'), 'max': ('名词', '马克斯'), 'bing': ('名词', '兵'), 'taotao': ('名词', '涛涛'), 'andy': ('名词', '安迪'), 'disneyland': ('名词', '迪士尼乐园'),
    'jiamin': ('名词', '嘉敏'), 'webbs': ('名词', '韦布一家'), 'aki': ('名词', '阿基'),
    'janet': ('名词', '珍妮特'), 'joan': ('名词', '琼'), 'songhua': ('名词', '松花'),
    'yuanmingyuan': ('名词', '圆明园'), 'zhuhai': ('名词', '珠海'),
    'shenzhen': ('名词', '深圳'),
    'dong': ('名词', '东'), 'ding': ('名词', '丁'),
    'competition': ('名词', '比赛'), 'enter': ('动词', '进入'),
    'mozart': ('名词', '莫扎特'), 'milan': ('名词', '米兰'), 'switzerland': ('名词', '瑞士'),
    'austria': ('名词', '奥地利'), 'xiaoling': ('名词', '晓玲'), 'joanne': ('名词', '乔安妮'),
    'kathleen': ('名词', '凯瑟琳'), 'rowling': ('名词', '罗琳'), 'bristol': ('名词', '布里斯托尔'),
    'potter': ('名词', '波特'), 'nelson': ('名词', '纳尔逊'), 'mandela': ('名词', '曼德拉'),
    'anhui': ('名词', '安徽'), 'deng': ('名词', '邓'), 'daniel': ('名词', '丹尼尔'),
    'gelato': ('名词', '吉拉头'), 'harry': ('名词', '哈利'), 'ruth': ('名词', '露丝'),
    'baobao': ('名词', '宝宝'), 'guoguo': ('名词', '果果'), 'meimei': ('名词', '美美'),
    'zhi': ('名词', '志'), 'ru': ('名词', '茹'), 'sima': ('名词', '司马'),
    'guang': ('名词', '光'), 'jenny': ('名词', '珍妮'), 'macao': ('名词', '澳门'),
    'temple': ('名词', '庙宇'), 'diver': ('名词', '跳水运动员'), 'salmon': ('名词', '鲑鱼'),
    'trout': ('名词', '鳟鱼'), 'instead': ('副词', '代替'), 'admit': ('动词', '承认'),
    'teller': ('名词', '出纳员'), 'nephew': ('名词', '侄子'), 'vat': ('名词', '缸'),
        'jiaxuan': ('名词', '嘉轩'), 'zheng': ('名词', '郑'), 'he': ('名词', '和'),
    'foolish': ('形容词', '愚蠢的'), 'thick': ('形容词', '浓的'),
    'labour': ('名词', '劳动'), 'cpc': ('名词', '中共'), 'pla': ('名词', '解放军'),
    'taishan': ('名词', '泰山'), 'confucius': ('名词', '孔子'),
    'pocket': ('名词', '口袋'), 'tale': ('名词', '故事'),
    'knot': ('名词', '结'), 'mia': ('名词', '米娅'), 'yoyo': ('名词', '悠悠'),
    'dining': ('形容词', '用餐的'), 'guizhou': ('名词', '贵州'), 'poster': ('名词', '海报'),
    'fiction': ('名词', '小说'), 'key': ('名词', '钥匙'),
    'mongolia': ('名词', '蒙古'), 'mimi': ('名词', '咪咪'), 'naadam': ('名词', '那达慕'), 'folklore': ('名词', '民间传说'),
    'tutu': ('名词', '图图'), 'nian': ('名词', '年兽'), 'duoduo': ('名词', '多多'),
    'xiaojun': ('名词', '小军'), 'momo': ('名词', '默默'), 'feifei': ('名词', '菲菲'),
    'wenwen': ('名词', '文文'), 'lili': ('名词', '莉莉'), 'united': ('形容词', '联合的'),
    'nations': ('名词', '国家'), 'hanami': ('名词', '赏花'), 'mei': ('名词', '梅'),
    'davy': ('名词', '戴维'), 'snack': ('名词', '零食'),
    'lulu': ('名词', '露露'), 'olivia': ('名词', '奥利维娅'), 'bobo': ('名词', '波波'),
    'susu': ('名词', '苏苏'), 'terry': ('名词', '特里'), 'qinwen': ('名词', '沁文'),
    'fei': ('名词', '菲'), 'yanyan': ('名词', '燕燕'), 'smart': ('名词', '斯马特'),
    'animals': ('名词', '动物'), 'apples': ('名词', '苹果'), 'bananas': ('名词', '香蕉'),
    'books': ('名词', '书'), 'calendar': ('名词', '日历'), 'case': ('名词', '盒子'),
    'course': ('名词', '课程'), 'education': ('名词', '教育'), 'friends': ('名词', '朋友'),
    'games': ('名词', '游戏'), 'noise': ('名词', '噪音'), 'photos': ('名词', '照片'),
    'pictures': ('名词', '图画'), 'pool': ('名词', '游泳池'), 'post': ('名词', '帖子'),
    'roast': ('形容词', '烤的'), 'running': ('名词', '跑步'), 'runs': ('动词', '跑'),
    'set': ('动词', '摆放'), 'setting': ('名词', '环境'), 'social': ('形容词', '社交的'),
 'delivery': ('名词', '快递'), 'pe': ('名词', '体育课'),
    'chore': ('名词', '家务'), 'sweep': ('动词', '打扫'), 'firefighter': ('名词', '消防员'),
    'cleaner': ('名词', '清洁工'), 'snowman': ('名词', '雪人'), 'playground': ('名词', '操场'),
    'community': ('名词', '社区'), 'toilet': ('名词', '厕所'), 'pam': ('名词', '帕姆'), 'auntie': ('名词', '阿姨'),
    'cd': ('名词', '光盘'), 'method': ('名词', '方法'), 'graduation': ('名词', '毕业'),
    'ceremony': ('名词', '典礼'), 'california': ('名词', '加利福尼亚'),
    'rehearsal': ('名词', '彩排'), 'allen': ('名词', '艾伦'), 'primary': ('形容词', '初级的'),
    'olympic': ('形容词', '奥林匹克的'), 'olympics': ('名词', '奥运会'),
    'athlete': ('名词', '运动员'), 'athletes': ('名词', '运动员'),
    'xerox': ('名词', '施乐'), 'kung': ('名词', '功'), 'fu': ('名词', '夫'),
    'compass': ('名词', '指南针'), 'century': ('名词', '世纪'), 'bc': ('名词', '公元前'),
    'million': ('数词', '百万'), 'patience': ('名词', '耐心'), 'conduct': ('名词', '作风'),
    'conducts': ('名词', '作风'), 'olympia': ('名词', '奥林匹亚'),
    'greece': ('名词', '希腊'), 'host': ('动词', '主办'), 'medal': ('名词', '奖牌'),
    'medals': ('名词', '奖牌'), 'motto': ('名词', '口号'), 'stadium': ('名词', '体育场'),
    'army': ('名词', '军队'), 'scarf': ('名词', '围巾'), 'modern': ('形容词', '现代的'),
    'cyp': ('名词', '少先队'), 'birth-year': ('名词', '生肖'), 'canada': ('名词', '加拿大'),
    'laura': ('名词', '劳拉'),
'culture': ('名词', '文化'), 'europe': ('名词', '欧洲'), 'main': ('形容词', '主要的'), 'italian': ('形容词', '意大利的'),
    'xiaomei': ('名词', '小梅'), 'kuan': ('名词', '宽'), 'gao': ('名词', '高'),
    'xiaoqiang': ('名词', '小强'), 'p.e': ('名词', '体育'), 'monitor': ('名词', '班长'),
    'finland': ('名词', '芬兰'), 'spain': ('名词', '西班牙'), 'toronto': ('名词', '多伦多'),
    'fried': ('形容词', '油炸的'), 'junk': ('名词', '垃圾'),
    'wings': ('名词', '翅膀'), 'wing': ('名词', '翅膀'), 'fuji': ('名词', '富士'),
    'bulletin': ('名词', '公告'), 'wag': ('动词', '摇'), 'lid': ('名词', '盖子'),
    'valentine': ('名词', '情人节贺卡'), 'poem': ('名词', '诗'), 'bumper': ('名词', '缓冲器'),
    'universal': ('形容词', '普遍的'), 'gravitation': ('名词', '引力'), 'nobel': ('名词', '诺贝尔'),
    'railway': ('名词', '铁路'), 'runner': ('名词', '赛跑者'), 'step': ('名词', '脚步；台阶'), 'roll': ('名词', '卷'), 'takeaway': ('形容词', '外卖的'), 'double': ('形容词', '双的；双倍的'),
    'fifteenth': ('数词', '第十五'), 'sixteenth': ('数词', '第十六'),
    'eighteenth': ('数词', '第十八'), 'nineteenth': ('数词', '第十九'),
    'twentieth': ('数词', '第二十'), 'mobile': ('形容词', '移动的'),
    'halloween': ('名词', '万圣节前夜'), 'witch': ('名词', '巫婆'),
    'lunar': ('形容词', '阴历的'), 'peace': ('名词', '和平'),
    'sleigh': ('名词', '雪橇'), 'reindeer': ('名词', '驯鹿'),
    'duty': ('名词', '值班'), 'sale': ('名词', '减价出售'), 'usual': ('形容词', '通常的'),
    'muscle': ('名词', '肌肉'), 'deeply': ('副词', '深深地'), 'taijiquan': ('名词', '太极拳'),
    'lonely': ('形容词', '孤独的'), 'busier': ('形容词', '更忙的'), 'fill': ('动词', '充满'),
    'court': ('名词', '球场'), 'sandcastle': ('名词', '沙堡'), 'lizard': ('名词', '蜥蜴'),
    'musical': ('形容词', '音乐的'), 'add': ('动词', '添加'), 'dentist': ('名词', '牙医'),
    'packet': ('名词', '小包'), 'tunnel': ('名词', '隧道'), 'entry': ('名词', '进入'),
    'junior': ('形容词', '初级的'), 'horn': ('名词', '角'), 'upon': ('介词', '在……上'),
    'bin': ('名词', '垃圾箱'), 'rhino': ('名词', '犀牛'), 'goggles': ('名词', '护目镜'),
    'swimsuit': ('名词', '游泳衣'), 'gatekeeper': ('名词', '门卫'), 'pod': ('名词', '豆荚'),
    'mind': ('名词', '头脑'), 'eggshell': ('名词', '蛋壳'), 'yoyo': ('名词', '悠悠球'),
    'text': ('名词', '课文'), 'goalkeeper': ('名词', '守门员'), 'schoolwork': ('名词', '学校作业'),
    'buckingham': ('名词', '白金汉'), 'kangaroo': ('名词', '袋鼠'), 'stripe': ('名词', '条纹'),
    'lick': ('动词', '舔'), 'lantern': ('名词', '灯笼'), 'snowball': ('名词', '雪球'),
    'comb': ('动词', '梳'), 'hallway': ('名词', '走廊'), 'donut': ('名词', '面包圈'),
    'continent': ('名词', '大洲'), 'energy': ('名词', '能量'), 'states': ('名词', '合众国'),
    'ai': ('名词', '人工智能'), 'cartoon': ('名词', '动画片'), 'pyramid': ('名词', '金字塔'),
    'zealand': ('名词', '西兰'), 'expo': ('名词', '博览会'), 'forbidden': ('形容词', '禁止的'),
    'inuit': ('名词', '因纽特人'), 'yogurt': ('名词', '酸奶'),
    'trash': ('名词', '垃圾'), 'scared': ('形容词', '害怕的'),
    'indeed': ('副词', '确实'), 'shine': ('动词', '照耀'), 'atomic': ('形容词', '原子的'),
    'skate': ('动词', '滑冰'), 'seafood': ('名词', '海鲜'),
}


def bad(k, v):
    """脏词条判定：空 / 释义=英文原文 / 没有汉字（历史语料自指污染）"""
    pos, cn = v[0], (v[1] or '').strip()
    if pos == '标点':
        return False
    if not cn:
        return True
    if not re.search(r'[\u4e00-\u9fff]', cn):
        # 允许 ABC / USA 这类纯缩写释义
        if re.fullmatch(r'[A-Z0-9][A-Z0-9&.]*', cn) and cn.upper() == k.upper():
            return False
        return True
    return cn.lower() == k.lower()


def guess_pos(cn):
    """从中文释义粗判词性（词块标注用）"""
    if not cn:
        return '名词'
    c = re.split(r'[；;，,。、/]', cn)[0].strip()
    if c.endswith('地'):
        return '副词'
    if c.endswith('的'):
        return '形容词'
    if re.match(r'^(在|从|到|向|朝|为|和|与|对|把|被|比|沿着|乘)', c) and len(c) <= 9:
        return '介词'
    if c in ('和', '或者', '但是', '所以', '因为', '如果', '当……时', '比'):
        return '连词'
    if re.match(r'^(一|二|三|四|五|六|七|八|九|十|几|第)', c) and len(c) <= 3:
        return '数词'
    return '名词'


def main():
    lex = {}
    stat = Counter()

    # 功能词优先
    for k, v in FUNC.items():
        lex[k] = v
        stat['func'] += 1

    # 单词表（不覆盖已有功能词）
    bank = load_wordbank()
    for k, cn in bank.items():
        if k in lex:
            continue
        lex[k] = (guess_pos(cn), re.split(r'[；;]', cn)[0].strip())
        stat['wordbank'] += 1

    # 历史语料：token 级标注（词性更准），覆盖在单词表之上
    votes = {}
    for f in glob.glob(os.path.join(BACKUP, '*.tsv')):
        for ln in open(f, encoding='utf-8'):
            cols = ln.replace('\ufeff', '').rstrip('\n').split('\t')
            if len(cols) < 5:
                continue
            en, poses, cns = cols[2], cols[3].split('|'), cols[4].split('|')
            parts = en.split()
            if len(parts) != len(poses) or len(parts) != len(cns):
                continue
            for p, pos, cn in zip(parts, poses, cns):
                k = key(p)
                pos, cn = pos.strip(), cn.strip()
                if not k or pos not in POS_OK or not cn or cn == '?':
                    continue
                votes.setdefault(k, Counter())[(pos, cn)] += 1

    for k, cnt in votes.items():
        best = cnt.most_common(1)[0][0]
        # 功能词保持手写值（语料里可能把 the 标成"这个"之类）
        if k in FUNC:
            continue
        # 已有可读释义时不让语料覆盖（历史语料里混了大量"释义=英文原文"的脏数据）
        if k in lex and not bad(k, lex[k]):
            continue
        if bad(k, ('名词', best[1])):
            continue
        lex[k] = best
        stat['corpus'] += 1

    # 人名/地名最后覆盖（音译比语料里的英文原文更可读）
    for k, cn in PERSONS.items():
        lex[k] = ('名词', cn)
        stat['person'] += 1

    # 不规则变形指向原形释义
    for form, base in IRREG.items():
        if form not in lex and base in lex:
            lex[form] = lex[base]
            stat['irregular'] += 1

    # 教材常见词补充
    for k, v in EXTRA.items():
        lex[k] = v
        stat['extra'] += 1

    # 标点（破折号等单独成 token 时不要留 ?）
    for punct in ['—', '–', '-', '&']:
        lex[punct] = ('标点', punct)

    # 清洗：丢掉"释义=英文原文/空/无汉字"的脏词条（历史语料里的自指污染）
    dirty = [(k, v) for k, v in lex.items() if bad(k, v)]
    for k, v in dirty:
        del lex[k]
    if dirty:
        print(f'清洗脏词条 {len(dirty)}')
        for k, v in sorted(dirty)[:40]:
            print('   -', k, '=>', v)

    out = os.path.join(HERE, 'token_lex.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(lex, f, ensure_ascii=False, indent=0, sort_keys=True)
    print(f'写入 {out}')
    print(f'总计 {len(lex)} 词条 | 功能词 {stat["func"]} · 单词表 {stat["wordbank"]} · 语料覆盖 {stat["corpus"]}')
    print(f'语料有效词形 {len(votes)}')


if __name__ == '__main__':
    main()
