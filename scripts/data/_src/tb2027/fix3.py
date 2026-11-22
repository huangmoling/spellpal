# -*- coding: utf-8 -*-
"""第三轮：剔除无实义的变形词条、修词形碎片、补齐专有名词音标。

辽师大、冀教的词表把动词的「进行时 / 第三人称单数 / 过去式」也列成词条，
中文释义只有「（进行时）」这种占位，没有实际意思 —— 这类不当作词条收，
否则孩子看到「cleaning the windows」配「（进行时）」完全学不到东西。
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

# 释义只有变形标记、没有实义 → 剔除
EMPTY_GLOSS = re.compile(r'^[（(]?\s*(进行时|第三人称单数|过去式|复数)\s*[）)]?\s*$')

# 词形碎片 / 释义碎片
FIX = {
    'museum useum': ('museum', '博物馆', '/mjuˈziːəm/'),
    'map ap': ('map', '地图', '/mæp/'),
    'satur saturday day': ('Saturday', '星期六', '/ˈsætədeɪ/'),
    'i\'d like=i would like': ('I\'d like', '我想要', '/aɪd laɪk/'),
    'surfs the': None,
    'internet（第三人称单数）': None,
    'has': ('has', '有（第三人称单数）', '/hæz/'),
    'worry': ('worry', '担心（复数 worries）', '/ˈwʌri/'),
    'child': ('child', '孩子（复数 children）', '/tʃaɪld/'),
    'make': ('make', '制作（过去式 made）', '/meɪk/'),
    'i’m': ('I’m', '我（是）……', '/aɪm/'),
    'it’s': ('it’s', '它（是）……', '/ɪts/'),
    'what’s': ('what’s', '是什么', '/wɒts/'),
    'hurt': ('hurt', '（使）受伤；感到疼痛', '/hɜːt/'),
    'much': ('much', '多少；很；非常', '/mʌtʃ/'),
    'out': ('out', '从……里出来', '/aʊt/'),
    'well': ('well', '对了；健康', '/wel/'),
    'glove': ('glove', '（分手指的）手套', '/ɡlʌv/'),
    'hat': ('hat', '（常指带檐的）帽子', '/hæt/'),
    'teddy bear': ('teddy bear', '（软的）玩具熊', '/ˈtedi beə(r)/'),
    'will': ('will', '（表示将来）会；将', '/wɪl/'),
    'beanbag': ('beanbag', '（玩游戏用的）沙包', '/ˈbiːnbæɡ/'),
    'group': ('group', '（小）组，群', '/ɡruːp/'),
    'paw': ('paw', '（动物的）爪子', '/pɔː/'),
    'really': ('really', '当真；确实', '/ˈrɪəli/'),
    'yelp': ('yelp', '（因疼痛等）叫喊', '/jelp/'),
    'salesperson': ('salesperson', '售货员，推销员', '/ˈseɪlzpɜːsn/'),
    'valentine’s day': ('Valentine’s Day', '情人节，爱心节', '/ˈvæləntaɪnz deɪ/'),
    'cleaned the room': ('cleaned the room', '打扫房间（过去式）', '/kliːnd ðə ruːm/'),
    'washed clothes': ('washed clothes', '洗衣服（过去式）', '/wɒʃt kləʊðz/'),
    'cooked dinner': ('cooked dinner', '做饭（过去式）', '/kʊkt ˈdɪnə(r)/'),
    'watered the flowers': ('watered the flowers', '浇花（过去式）', '/ˈwɔːtəd ðə ˈflaʊəz/'),
    'watched cartoons': ('watched cartoons', '看动画片（过去式）', '/wɒtʃt kɑːˈtuːnz/'),
    'played games': ('played games', '做游戏（过去式）', '/pleɪd ɡeɪmz/'),
    'sang and danced': ('sang and danced', '唱歌跳舞（过去式）', '/sæŋ ənd dɑːnst/'),
    'got up': ('got up', '起床（过去式）', '/ɡɒt ʌp/'),
    'goes boating': ('goes boating', '去划船（第三人称单数）', '/ɡəʊz ˈbəʊtɪŋ/'),
    'surfs the internet': ('surfs the Internet', '上网（第三人称单数）', '/sɜːfs ði ˈɪntənet/'),
}

IPA = {
    "shouldn’t": '/ˈʃʊdnt/', 'fine': '/faɪn/', 'idea': '/aɪˈdɪə/', 'while': '/waɪl/',
    'zero': '/ˈzɪərəʊ/', 'prefer': '/prɪˈfɜː(r)/', 'be': '/biː/', 'favourite': '/ˈfeɪvərɪt/',
    'maths': '/mæθs/', 'mr': '/ˈmɪstə(r)/', 'mrs': '/ˈmɪsɪz/', 'mum': '/mʌm/',
    'pe': '/ˌpiː ˈiː/', "that’s": '/ðæts/', 'geese': '/ɡiːs/', 'tomatoes': '/təˈmɑːtəʊz/',
    'potatoes': '/pəˈteɪtəʊz/', 'peppers': '/ˈpepəz/', 'beans': '/biːnz/',
    'cabbages': '/ˈkæbɪdʒɪz/', 'guitar': '/ɡɪˈtɑː(r)/', 'play the guitar': '/pleɪ ðə ɡɪˈtɑː(r)/',
    'pants': '/pænts/', 'congo': '/ˈkɒŋɡəʊ/', 'egypt': '/ˈiːdʒɪpt/', 'inuit': '/ˈɪnjuɪt/',
    "teachers’ office": '/ˈtiːtʃəz ˈɒfɪs/', 'field': '/fiːld/', 'goat': '/ɡəʊt/',
    'watch cartoons': '/wɒtʃ kɑːˈtuːnz/', 'do morning exercises': '/duː ˈmɔːnɪŋ ˈeksəsaɪzɪz/',
    'pyramid': '/ˈpɪrəmɪd/', 'scared': '/skeəd/', 'maybe': '/ˈmeɪbi/', 'towel': '/ˈtaʊəl/',
    'sandals': '/ˈsændlz/', 'slippers': '/ˈslɪpəz/', 'sneakers': '/ˈsniːkəz/',
    'e-pal': '/ˈiː pæl/', 'new zealand': '/ˌnjuː ˈziːlənd/', 'editor': '/ˈedɪtə(r)/',
    'article': '/ˈɑːtɪkl/', 'blog': '/blɒɡ/', 'interest': '/ˈɪntrəst/', 'surf': '/sɜːf/',
    'visit grandparents': '/ˈvɪzɪt ˈɡrænpeərənts/', 'feed chickens': '/fiːd ˈtʃɪkɪnz/',
    'food expo': '/fuːd ˈekspəʊ/', 'the forbidden city': '/ðə fəˈbɪdn ˈsɪti/',
    'terrible': '/ˈterəbl/', 'neighbor': '/ˈneɪbə(r)/', 'champion': '/ˈtʃæmpiən/',
    'someday': '/ˈsʌmdeɪ/', 'schoolyard': '/ˈskuːljɑːd/', 'england': '/ˈɪŋɡlənd/',
    'germany': '/ˈdʒɜːməni/', 'nobel prize': '/nəʊˈbel praɪz/',
    "mother’s day": '/ˈmʌðəz deɪ/', "father’s day": '/ˈfɑːðəz deɪ/',
    'australian football': '/ɒˈstreɪliən ˈfʊtbɔːl/', 'disneyland': '/ˈdɪznilænd/',
    'taipei': '/ˌtaɪˈpeɪ/', 'spaceship': '/ˈspeɪsʃɪp/',
    'watering the flowers': '/ˈwɔːtərɪŋ ðə ˈflaʊəz/',
    'taking pictures': '/ˈteɪkɪŋ ˈpɪktʃəz/',
    'playing the guitar': '/ˈpleɪɪŋ ðə ɡɪˈtɑː(r)/',
    'eating': '/ˈiːtɪŋ/', 'drinking': '/ˈdrɪŋkɪŋ/', 'sleeping': '/ˈsliːpɪŋ/',
    'likes singing': '/laɪks ˈsɪŋɪŋ/', 'jumps high': '/dʒʌmps haɪ/',
    'runs fast': '/rʌnz fɑːst/', 'dances well': '/ˈdɑːnsɪz wel/',
    'goes camping': '/ɡəʊz ˈkæmpɪŋ/', 'goes fishing': '/ɡəʊz ˈfɪʃɪŋ/',
    'collects stones': '/kəˈlekts stəʊnz/', 'collects stamps': '/kəˈlekts stæmps/',
    'goes hiking': '/ɡəʊz ˈhaɪkɪŋ/', 'goes to work': '/ɡəʊz tə wɜːk/',
    'does cleaning': '/dʌz ˈkliːnɪŋ/', 'cooks meals': '/kʊks miːlz/',
    'watches tv': '/ˈwɒtʃɪz ˌtiː ˈviː/', 'washes clothes': '/ˈwɒʃɪz kləʊðz/',
    'draws pictures': '/drɔːz ˈpɪktʃəz/', 'does exercise': '/dʌz ˈeksəsaɪz/',
    'writes an email': '/raɪts ən ˈiːmeɪl/',
}


def run():
    removed = 0
    for f in sorted(glob.glob(os.path.join(HERE, '*.words.json'))):
        d = json.load(open(f, encoding='utf-8'))
        out = []
        for w in d['words']:
            g = w.get('gloss', '').strip()
            if EMPTY_GLOSS.match(g):
                removed += 1
                continue
            k = w['word'].lower()
            if k in FIX:
                v = FIX[k]
                if v is None:
                    removed += 1
                    continue
                w['word'], w['gloss'], w['ipaUK'] = v
            elif not w.get('ipaUK') and k in IPA:
                w['ipaUK'] = IPA[k]
            # 释义里残留的「复数 xxx)」「过去式 xxx)」括号补齐
            g = w.get('gloss', '')
            g = re.sub(r'^([^（(]+?)\s*([^(（]*?)\s*[)）]\s*', lambda m: m.group(0), g)
            w['gloss'] = g
            out.append(w)
        d['words'] = out
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('剔除', removed)
    tot = sum(1 for f in glob.glob(os.path.join(HERE, '*.words.json'))
              for _ in json.load(open(f, encoding='utf-8'))['words'])
    print('剩余词条', tot)


if __name__ == '__main__':
    run()
