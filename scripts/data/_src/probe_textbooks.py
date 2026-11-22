# -*- coding: utf-8 -*-
"""探测教材 PDF：页数、文字层、页面尺寸。"""
import os, sys, json
import pymupdf

ROOT = r'F:\桌面\教材\2026秋小学新教材'

rows = []
for dirpath, _, files in os.walk(ROOT):
    for f in sorted(files):
        if not f.lower().endswith('.pdf'):
            continue
        p = os.path.join(dirpath, f)
        try:
            doc = pymupdf.open(p)
            n = doc.page_count
            # 抽样 4 页看文字层
            idxs = [0, n // 3, n // 2, n - 1] if n > 4 else list(range(n))
            chars = []
            for i in dict.fromkeys(idxs):
                if 0 <= i < n:
                    chars.append(len(doc[i].get_text('text').strip()))
            imgs = len(doc[0].get_images(full=True)) if n else 0
            r = doc[0].rect if n else None
            rows.append({
                'publisher_dir': os.path.basename(dirpath),
                'file': f,
                'pages': n,
                'chars_sample': chars,
                'images_p0': imgs,
                'size': round(r.width, 1) if r else 0,
                'mb': round(os.path.getsize(p) / 1048576, 1),
            })
            doc.close()
        except Exception as e:
            rows.append({'file': f, 'error': str(e)[:80]})

print(json.dumps(rows, ensure_ascii=False, indent=1))
