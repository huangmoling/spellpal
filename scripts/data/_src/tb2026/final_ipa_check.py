# -*- coding: utf-8 -*-
"""音标终检：统一码点、去掉并列读音、兜掉个别错音。

放在 fill_ipa.py 之后跑，保证写进 words.json 的 ipaUK 只有一种记法。
"""
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

# 逐条纠正（词典里给了并列读音或明显错音，课本语境只有一个）
FIX = {
    'noise': '/nɔɪz/',
}


def clean(ipa, word):
    if not ipa:
        return ipa
    if word.lower() in FIX:
        return FIX[word.lower()]
    s = ipa
    # 'lɪv; laɪv' → 只留课本词义对应的那个读音（先去斜杠再切，避免切掉收尾的 /）
    body = s.strip('/').replace(';', '|').split('|')[0].strip()
    body = body.replace('g', '\u0261')              # 统一 IPA ɡ
    body = re.sub(r'\s+', ' ', body)
    return '/' + body + '/'


def main():
    n = 0
    for f in sorted(glob.glob(os.path.join(HERE, '*.words.json'))):
        d = json.load(open(f, encoding='utf-8'))
        changed = 0
        for w in d['words']:
            old = w.get('ipaUK')
            new = clean(old, w['word'])
            if new != old:
                w['ipaUK'] = new
                changed += 1
        if changed:
            json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f"  {d['book']:8s} 修正 {changed} 条")
            n += changed
    print('合计修正', n)


if __name__ == '__main__':
    main()
