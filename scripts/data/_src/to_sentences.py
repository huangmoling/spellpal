#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把 _src/{bookId}.sentences.json 转成 sentences-{bookId}.tsv。

每个词块的词性/中文优先从已上线 19 册的句子里复用（同一个词在教材语境里的译法基本一致），
复用不到就看 OVERRIDE；两边都没有就报错，逼着人工补，不允许空着进库。
"""
import json
import io
import os
import re
import sys
import glob

ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

# 现有句库里没有、或者现有译法不符合本单元语境的，手工指定。
# key 用小写去标点后的词形。
OVERRIDE = {
    "i'm": ("我是", "缩略"),
    "what's": ("是什么", "缩略"),
    "bobby": ("波比", "名词"),
    "beibei": ("贝贝", "名词"),
    "su hai": ("苏海", "名词"),
    "su yang": ("苏阳", "名词"),
    "liu tao": ("刘涛", "名词"),
    "li": ("李", "名词"),
    "class": ("同学们", "名词"),
    "grandpa": ("爷爷", "名词"),
    "grandma": ("奶奶", "名词"),
    "uncle": ("舅舅", "名词"),
    "cool": ("酷", "形容词"),
    "grow": ("生长", "动词"),
    "hi": ("嗨", "感叹词"),
    "miss": ("小姐", "名词"),
    "goodbye": ("再见", "感叹词"),
    "excuse": ("打扰", "动词"),
    "twins": ("双胞胎", "名词"),
    "right": ("正确", "形容词"),
    "friends": ("朋友", "名词"),
    "come": ("来", "动词"),
    "pictures": ("图画", "名词"),
    "ben": ("本", "名词"),

    # ---- 三下（3B）新增 ----
    "rubber": ("橡皮", "名词"),
    "idea": ("主意", "名词"),
    "close": ("关", "动词"),
    "follow": ("遵守", "动词"),
    "rules": ("规则", "名词"),
    "you're": ("你", "缩略"),
    "break": ("课间", "名词"),
    "where's": ("在哪里", "缩略"),
    "butterfly": ("蝴蝶", "名词"),
    "goes": ("飞", "动词"),
    "they're": ("它们", "缩略"),
    "mango": ("芒果", "名词"),
    "mangoes": ("芒果", "名词"),
    "welcome": ("欢迎", "动词"),
    "those": ("那些", "代词"),
    "they": ("它们", "代词"),
    "rabbits": ("兔子", "名词"),
    "monkeys": ("猴子", "名词"),
    "lunchtime": ("午餐时间", "名词"),
    "feed": ("喂", "动词"),
    "little": ("小", "形容词"),

    # ---- 三下（3B）修正复用错义 ----
    # 下面这些词在旧 20 册里被别的语境占用过，直接复用会拼出错误的中文，
    # 所以 OVERRIDE 的优先级必须高于复用表（见 main() 里的取值顺序）。
    "it's": ("它是", "缩略"),
    "the": ("这个", "冠词"),
    "a": ("一个", "冠词"),
    "an": ("一个", "冠词"),
    "in": ("在……里", "介词"),
    "behind": ("在……后面", "介词"),
    "at": ("向", "介词"),
    "quiet": ("安静的", "形容词"),
    "keep": ("保持", "动词"),
    "far": ("远", "副词"),
    "too": ("也", "副词"),
    "sweep": ("打扫", "动词"),
    "things": ("用品", "名词"),
    "panda": ("大熊猫", "名词"),
    "salad": ("沙拉", "名词"),
    "chameleon": ("变色龙", "名词"),
    "let's": ("让我们", "缩略"),
    "don't": ("不要", "助动词"),
}


def norm(w):
    w = re.sub(r"[,.!?;:\"“”‘’]", "", w.strip())
    return w.strip().lower()


def load_token_table():
    table = {}
    for f in glob.glob(os.path.join(ROOT, "src/data/books/*.json")):
        d = json.load(io.open(f, encoding="utf-8"))
        for s in d.get("sentences", []):
            for t in s.get("tokens", []):
                k = norm(t["en"])
                if k and t.get("cn") and t.get("pos"):
                    table.setdefault(k, (t["cn"], t["pos"]))
    return table


def main(book):
    src_path = os.path.join(ROOT, "scripts/data/_src", f"{book}.sentences.json")
    data = json.load(io.open(src_path, encoding="utf-8"))
    table = load_token_table()

    missing = []
    lines = []
    for u in data["units"]:
        for cn, en in u["sentences"]:
            parts = en.split()
            cns, poses = [], []
            for p in parts:
                k = norm(p)
                got = OVERRIDE.get(k) or table.get(k)
                if not got:
                    missing.append(f"U{u['no']} {en} -> {p}")
                    cns.append("?")
                    poses.append("?")
                else:
                    cns.append(got[0])
                    poses.append(got[1])
            lines.append((u["no"], cn, en, "|".join(poses), "|".join(cns)))

    if missing:
        print("缺词块，先补 OVERRIDE：")
        for m in missing:
            print("  ", m)
        return 1

    out = os.path.join(ROOT, "scripts/data", f"sentences-{book}.tsv")
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        for unit, cn, en, poses, cns in lines:
            f.write("\t".join([str(unit), cn, en, poses, cns]) + "\n")
    print(f"写入 {out}")
    print(f"{len(data['units'])} 单元 / {len(lines)} 句")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "yilin-3a"))
