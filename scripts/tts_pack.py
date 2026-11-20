#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
预生成全库发音音频（离线语音包）。

为什么要这个脚本
----------------
程序原先用 Web Speech API 朗读，走的是 Windows SAPI 音色。实际用户机器上往往
只装了中文音色（Huihui / Kangkang / Yaoyao），程序只能拿中文音色念英文，
听起来非常生硬；而且 Web Speech 的音量上限锁死在 1.0，接不进应用的
Web Audio 增益链，音量也提不上去。

这里改用神经语音把词句批量合成成 mp3，随程序分发。运行时用 Web Audio 播放，
音质和音量两个问题一起解决。

用法
----
    pip install edge-tts
    python scripts/tts_pack.py                  # 增量生成，已存在的跳过
    python scripts/tts_pack.py --force          # 全部重生成
    python scripts/tts_pack.py --voice en-US-JennyNeural

产物
----
    public/voice/<hash>.mp3        每段一个文件，约 12 KB
    src/data/voice-index.json      { "英文原文": "hash" } 索引，运行时查表

这些产物进仓库，正常构建（npm run build / npm run dist）不需要再装 python。
"""

import argparse
import asyncio
import hashlib
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS_DIR = os.path.join(ROOT, "src", "data", "books")
OUT_DIR = os.path.join(ROOT, "public", "voice")
INDEX_PATH = os.path.join(ROOT, "src", "data", "voice-index.json")

DEFAULT_VOICE = "en-US-AriaNeural"
# 单词读得比句子再慢一点，小学生要听清每个音
WORD_RATE = "-10%"
SENT_RATE = "-5%"


def collect():
    """从教材 JSON 里收集所有需要发音的文本，返回 (词表, 句表)，均去重且排序稳定。"""
    words, sentences = set(), set()
    for name in sorted(os.listdir(BOOKS_DIR)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(BOOKS_DIR, name), encoding="utf-8") as f:
            book = json.load(f)
        for w in book.get("words", []):
            text = (w.get("word") or "").strip()
            if text:
                words.add(text)
        for s in book.get("sentences", []):
            text = (s.get("en") or "").strip()
            if text:
                sentences.add(text)
    return sorted(words), sorted(sentences)


def key_of(text: str) -> str:
    """文本 → 文件名。用 sha1 前 12 位，避开空格、大小写、标点在文件系统上的麻烦。"""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


async def synth_one(text, path, voice, rate, sem, counters):
    async with sem:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            counters["skip"] += 1
            return True
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, voice, rate=rate)
                await comm.save(path)
                if os.path.getsize(path) > 0:
                    counters["ok"] += 1
                    done = counters["ok"] + counters["skip"]
                    print(f"[{done}/{counters['total']}] {text[:44]!r}", flush=True)
                    return True
            except Exception as exc:  # 网络抖动重试
                if attempt == 2:
                    print(f"  FAIL {text!r}: {exc}", flush=True)
                    counters["fail"].append(text)
                    return False
                await asyncio.sleep(1.5 * (attempt + 1))
        return False


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--force", action="store_true", help="忽略已有文件，全部重生成")
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    words, sentences = collect()
    print(f"词 {len(words)} 条，句 {len(sentences)} 条，共 {len(words) + len(sentences)} 段")

    os.makedirs(OUT_DIR, exist_ok=True)
    if args.force:
        for name in os.listdir(OUT_DIR):
            if name.endswith(".mp3"):
                os.remove(os.path.join(OUT_DIR, name))

    index = {}
    for text in words + sentences:
        index[text] = key_of(text)

    counters = {"ok": 0, "skip": 0, "fail": [], "total": len(index)}
    sem = asyncio.Semaphore(args.concurrency)

    jobs = []
    for text in words:
        jobs.append(synth_one(text, os.path.join(OUT_DIR, index[text] + ".mp3"), args.voice, WORD_RATE, sem, counters))
    for text in sentences:
        jobs.append(synth_one(text, os.path.join(OUT_DIR, index[text] + ".mp3"), args.voice, SENT_RATE, sem, counters))

    await asyncio.gather(*jobs)

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, sort_keys=True, indent=0)
        f.write("\n")

    total_bytes = sum(
        os.path.getsize(os.path.join(OUT_DIR, n))
        for n in os.listdir(OUT_DIR)
        if n.endswith(".mp3")
    )
    print(f"\n新生成 {counters['ok']}，跳过 {counters['skip']}，失败 {len(counters['fail'])}")
    print(f"音频目录 {total_bytes / 1024 / 1024:.1f} MB / {len(os.listdir(OUT_DIR))} 个文件")
    print(f"索引写入 {INDEX_PATH}")
    if counters["fail"]:
        print("失败清单：")
        for t in counters["fail"]:
            print("  " + t)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
