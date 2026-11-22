# -*- coding: utf-8 -*-
"""把 25 本教材逐页抽文本，落成 {key}.txt（带 === Pn === 页码标记）与索引 json。"""
import os, re, json
import pymupdf

ROOT = r'F:\桌面\教材\2026秋小学新教材'
OUT = r'F:\项目\学英语\spellpal\.tmp\tbtext'
os.makedirs(OUT, exist_ok=True)

# 目录关键字 -> 代号
PUB = [
    ('北京版', 'bj'),
    ('外研版', 'wy'),
    ('教科版', 'jk'),
    ('湘少版', 'xs'),
    ('译林版', 'yl'),
    ('人教版', 'rj'),
    ('沪教牛津版', 'hj'),
]


def key_of(dirname, fname):
    """从目录名 + 文件名定年级。译林有几本只写「五上英语书」「4上 课本」，要兜住。"""
    pub = next((k for pat, k in PUB if pat in dirname), 'xx')
    # 只从文件名解析年级：目录名里的「345年级上册」会把 4 年级误判成 5 年级
    m = re.search(r'([三四五六1-6])\s*年级', fname) or re.search(r'([三四五六1-6])\s*上', fname)
    g = m.group(1) if m else '?'
    g = {'1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六'}.get(g, g)
    return f'{pub}-{g}a'


index = []
for dirpath, _, files in os.walk(ROOT):
    for f in sorted(files):
        if not f.lower().endswith('.pdf'):
            continue
        path = os.path.join(dirpath, f)
        key = key_of(os.path.basename(dirpath), f)
        if os.path.exists(os.path.join(OUT, key + '.txt')):
            print(f'{key:8s} 已存在，跳过')
            continue
        doc = pymupdf.open(path)
        parts = []
        weak = []
        for i, page in enumerate(doc):
            t = page.get_text('text')
            parts.append(f'\n=== P{i + 1} ===\n{t}')
            if len(t.strip()) < 40:
                weak.append(i + 1)
        txt = ''.join(parts)
        open(os.path.join(OUT, key + '.txt'), 'w', encoding='utf-8').write(txt)
        index.append({'key': key, 'file': f, 'dir': os.path.basename(dirpath),
                      'pages': doc.page_count, 'chars': len(txt), 'weak_pages': weak})
        print(f'{key:8s} {doc.page_count:4d}p {len(txt):7d}chars  weak={len(weak)}  {f}')
        doc.close()

json.dump(index, open(os.path.join(OUT, '_index.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\n写出', len(index), '本 ->', OUT)
