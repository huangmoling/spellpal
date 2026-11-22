# -*- coding: utf-8 -*-
"""把扫描册指定页码范围渲染成 PNG，并把多页拼成一张联系表，方便一次性视读。"""
import os
import sys

import pymupdf
from PIL import Image, ImageDraw

ROOT = r'F:\桌面\教材\2026秋小学新教材'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'png')

BOOKS = {
    'jk-五a': os.path.join(ROOT, '26秋新教材电子版(教科版英语)3-6年级上册',
                           '2026秋广州教科版新教材五年级上册-英语 （仅限学习交流自用，不得二次售卖）.pdf'),
    'hj-五a': os.path.join(ROOT, '26秋新版教材电子版(沪教牛津版英语）345年级上册',
                           '26秋沪教牛津版五年级上册英语 彩色版.pdf'),
    'yl-四a': os.path.join(ROOT, '26秋新教材电子版(译林版英语)345年级上册',
                           '英语 译林 4上 课本 26秋.pdf'),
}


def render(key, pages, dpi=150):
    """渲染 1-based 页码列表，返回本地路径列表。"""
    dst = os.path.join(OUT, key)
    os.makedirs(dst, exist_ok=True)
    doc = pymupdf.open(BOOKS[key])
    files = []
    for p in pages:
        if p < 1 or p > doc.page_count:
            continue
        f = os.path.join(dst, f'p{p:03d}.png')
        if not os.path.exists(f):
            pix = doc[p - 1].get_pixmap(dpi=dpi)
            pix.save(f)
        files.append(f)
    doc.close()
    return files


def sheet(files, out, cols=2, scale=0.55):
    """把多页拼成联系表，左上角标页码。"""
    ims = [(os.path.basename(f), Image.open(f).convert('RGB')) for f in files]
    w = int(ims[0][1].width * scale)
    h = int(ims[0][1].height * scale)
    rows = (len(ims) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * w, rows * h), 'white')
    d = ImageDraw.Draw(canvas)
    for i, (name, im) in enumerate(ims):
        x, y = (i % cols) * w, (i // cols) * h
        canvas.paste(im.resize((w, h)), (x, y))
        d.rectangle([x, y, x + w - 1, y + h - 1], outline='#888')
        d.text((x + 6, y + 4), name.replace('.png', ''), fill='red')
    canvas.save(out)
    return out


if __name__ == '__main__':
    key = sys.argv[1]
    a, b = int(sys.argv[2]), int(sys.argv[3])
    files = render(key, list(range(a, b + 1)))
    print(sheet(files, os.path.join(OUT, f'{key}_sheet_{a}_{b}.png')))
