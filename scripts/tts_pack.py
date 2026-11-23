#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
小拼手 SpellPal · 离线语音包生成与打包程序

为什么要有这个程序
------------------
程序原先用 Web Speech API 朗读，走 Windows SAPI 音色。实际用户机器上往往只装了
中文音色（Huihui / Kangkang / Yaoyao），只能拿中文音色念英文，音素映射不对，
听着非常生硬；Web Speech 的 volume 上限还锁死在 1.0，接不进应用的 Web Audio
增益链，音量也提不上去。

改成预生成神经语音 mp3 之后，三个问题一起解决：音色正确、可归一化响度、可离线。

但这个流程原本只是一段二十来行的脚本，只能「一股脑全量重生成」，既没法看进度，
也没法校验产物、没法把音频打成分发包。全库一万多段音频跑起来要几十分钟，
中途断掉就得从头再来。所以重写成这个程序，把整条链路串起来：

    collect  从教材 JSON 收集所有要发音的文本，算出去重后的工作量
    synth    批量合成 mp3（增量续跑 / 并发 / 重试 / 断点进度）
    verify   校验索引与文件是否一致，找出缺失、坏档、孤儿文件
    pack     打成可分发的语音包（zip + manifest + 校验和，可切卷）
    stats    看覆盖率与体积构成
    all      synth → verify → pack 一条龙

用法
----
    pip install edge-tts

    python scripts/tts_pack.py collect              # 先看要合成多少段
    python scripts/tts_pack.py synth                # 增量合成，已存在且完好的跳过
    python scripts/tts_pack.py synth --limit 20     # 试跑 20 段
    python scripts/tts_pack.py synth --force        # 全部重生成
    python scripts/tts_pack.py verify               # 一致性体检
    python scripts/tts_pack.py verify --prune       # 顺手永久删掉孤儿 mp3
    python scripts/tts_pack.py pack --split-mb 50   # 打成分卷 zip
    python scripts/tts_pack.py all                  # 合成 → 校验 → 打包

    不带子命令时等价于 synth（兼容老用法 python scripts/tts_pack.py --force）

产物
----
    public/voice/<hash>.mp3         每段一个文件，约 12~16 KB（进仓库，随构建分发）
    src/data/voice-index.json       英文原文 → hash，运行时查表
    release/voice-pack/*.zip        分发用的语音包（release/ 已在 .gitignore 里）
    release/voice-pack/manifest.json  包清单，含分卷信息与校验和

设计约定
--------
* 文件名用文本 sha1 前 12 位，避开空格、大小写、标点在文件系统上的差异。
* 索引里的键是「英文原文」——运行时拿整句/整词去查，完全不占额外内存。
* 词比句读得慢，小学生要听清每个音；同一段文本若既在词表又在句表，按词处理。
* 先写 .part 临时文件再改名，中途断掉不会留下半截 mp3 被当成「已完成」。

注意：这里用的是 Edge「朗读」的非公开接口，攒成音频自用没问题，
正式商用请换成 Azure 订阅或开源模型。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import random
import re
import sys
import time
import zipfile
from datetime import datetime, timezone

try:
    import edge_tts
except ImportError:  # 允许 collect / verify / stats 在没装依赖时也能跑
    edge_tts = None

# ---------------------------------------------------------------- 路径与常量

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS_DIR = os.path.join(ROOT, "src", "data", "books")
VOICE_DIR = os.path.join(ROOT, "public", "voice")
INDEX_PATH = os.path.join(ROOT, "src", "data", "voice-index.json")
PACK_DIR = os.path.join(ROOT, "release", "voice-pack")

DEFAULT_VOICE = "en-US-AriaNeural"
# 单词读得比句子再慢一点，小学生要听清每个音
DEFAULT_WORD_RATE = "-10%"
DEFAULT_SENT_RATE = "-5%"

# 小于这个字节数基本可以断定是坏档（最短的 "a" 也有 4 KB 上下）
MIN_MP3_BYTES = 600

PACK_FORMAT = "spellpal-voice-pack"
PACK_VERSION = 1


# ---------------------------------------------------------------- 小工具


def die(msg: str) -> "None":
    print(f"错误：{msg}", file=sys.stderr)
    sys.exit(1)


def human(n: float) -> str:
    """字节数转成人看的大小"""
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024
    return f"{n:.1f} GB"


def fmt_dur(sec: float) -> str:
    s = int(max(0, sec))
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m{s % 60:02d}s"
    return f"{s // 3600}h{(s % 3600) // 60:02d}m"


def norm_text(text: str) -> str:
    """统一空白：全角空格、不换行空格、连续换行都压成单个空格"""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.replace("\u00a0", " ").replace("\u3000", " ")).strip()


def key_of(text: str) -> str:
    """文本 → 文件名。sha1 前 12 位（48 bit），一万条量级碰撞概率可忽略。"""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def is_valid_mp3(path: str) -> bool:
    """粗判 mp3 是否完好：大小够、帧头正常。"""
    try:
        if os.path.getsize(path) < MIN_MP3_BYTES:
            return False
        with open(path, "rb") as f:
            head = f.read(3)
        if len(head) < 3:
            return False
        return head[:3] == b"ID3" or head[0] == 0xFF
    except OSError:
        return False


def load_index() -> dict:
    if not os.path.exists(INDEX_PATH):
        return {}
    try:
        with open(INDEX_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def save_index(index: dict) -> None:
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, sort_keys=True, indent=0)
        f.write("\n")


class Progress:
    """单行刷新的进度条。非 TTY（重定向到日志）时降级成每 50 条一行。"""

    def __init__(self, total: int):
        self.total = max(1, total)
        self.done = 0
        self.failed = 0
        self.t0 = time.time()
        self.width = 24
        self.tty = sys.stdout.isatty()
        self._last = 0.0

    def tick(self, text: str = "", ok: bool = True) -> None:
        self.done += 1
        if not ok:
            self.failed += 1
        now = time.time()
        if self.tty and now - self._last < 0.08 and self.done < self.total:
            return
        self._last = now
        self._render(text)

    def _render(self, text: str) -> None:
        pct = self.done / self.total
        fill = int(self.width * pct)
        bar = "#" * fill + "-" * (self.width - fill)
        elapsed = time.time() - self.t0
        rate = self.done / elapsed if elapsed > 0.2 else 0.0
        eta = (self.total - self.done) / rate if rate > 0 else 0.0
        line = (
            f"[{bar}] {self.done}/{self.total} {pct * 100:5.1f}% "
            f"{rate:5.1f}/s 剩 {fmt_dur(eta):>7}  {text[:36]}"
        )
        if self.tty:
            sys.stdout.write("\r" + line + " " * 8)
            sys.stdout.flush()
        elif self.done % 50 == 0 or self.done == self.total:
            print(line, flush=True)

    def close(self) -> None:
        if self.tty:
            self._render("")
            sys.stdout.write("\n")
            sys.stdout.flush()


# ---------------------------------------------------------------- collect


class Corpus:
    """全库需要发音的文本，按词 / 句分开，并记录每段文本出现在哪些册。"""

    def __init__(self) -> None:
        self.words: dict[str, set[str]] = {}
        self.sentences: dict[str, set[str]] = {}

    @staticmethod
    def _add(bucket: dict[str, set[str]], text: str, book_id: str) -> None:
        bucket.setdefault(text, set()).add(book_id)

    @property
    def texts(self) -> dict[str, str]:
        """文本 → 'word' | 'sentence'。同时是词和句的按词处理（读得慢一点）。"""
        out: dict[str, str] = {t: "sentence" for t in self.sentences}
        out.update({t: "word" for t in self.words})
        return out

    def __len__(self) -> int:
        return len(self.texts)


def collect_corpus(only_books: list[str] | None = None) -> Corpus:
    if not os.path.isdir(BOOKS_DIR):
        die(f"找不到教材目录 {BOOKS_DIR}")

    corpus = Corpus()
    names = sorted(n for n in os.listdir(BOOKS_DIR) if n.endswith(".json"))
    if only_books:
        want = {b.strip() for b in only_books}
        names = [n for n in names if n[: -len(".json")] in want]

    for name in names:
        book_id = name[: -len(".json")]
        try:
            with open(os.path.join(BOOKS_DIR, name), encoding="utf-8") as f:
                book = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            print(f"  跳过 {name}：{exc}")
            continue
        for w in book.get("words", []):
            text = norm_text(w.get("word") or "")
            if text:
                corpus._add(corpus.words, text, book_id)
        for s in book.get("sentences", []):
            text = norm_text(s.get("en") or "")
            if text:
                corpus._add(corpus.sentences, text, book_id)
    return corpus


def cmd_collect(args: argparse.Namespace) -> None:
    corpus = collect_corpus(args.books)
    index = load_index()
    texts = corpus.texts

    have = [t for t in texts if index.get(t) and is_valid_mp3(
        os.path.join(VOICE_DIR, index[t] + ".mp3"))]
    todo = [t for t in texts if t not in set(have)]

    print(f"教材词条  {len(corpus.words):>6} 条（去重后）")
    print(f"教材例句  {len(corpus.sentences):>6} 条（去重后）")
    print(f"合计文本  {len(texts):>6} 条")
    if texts:
        print(f"已有音频  {len(have):>6} 条（{len(have) / len(texts) * 100:.1f}%）")
        print(f"待合成    {len(todo):>6} 条")
        # 按现有均值粗估
        sizes = []
        for t in have[:200]:
            try:
                sizes.append(os.path.getsize(os.path.join(VOICE_DIR, index[t] + ".mp3")))
            except OSError:
                pass
        if sizes:
            avg = sum(sizes) / len(sizes)
            print(f"体积预估  {human(avg * len(todo))}（按均 {human(avg)}/条）")
            print(f"耗时预估  {fmt_dur(len(todo) / max(1, args.jobs) * 1.4)}（{args.jobs} 并发）")


# ---------------------------------------------------------------- synth


async def synth_one(
    text: str,
    path: str,
    voice: str,
    rate: str,
    sem: asyncio.Semaphore,
    progress: Progress,
) -> bool:
    """合成一段。先写 .part 再改名，失败重试三次。"""
    async with sem:
        tmp = path + ".part"
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, voice, rate=rate)
                await comm.save(tmp)
                if is_valid_mp3(tmp):
                    os.replace(tmp, path)
                    progress.tick(text, ok=True)
                    return True
                raise RuntimeError("产物不完整")
            except Exception as exc:  # 网络抖动、限流都走这里重试
                if os.path.exists(tmp):
                    try:
                        os.remove(tmp)
                    except OSError:
                        pass
                if attempt == 2:
                    progress.tick(text, ok=False)
                    print(f"\n  失败 {text[:50]!r}: {exc}", flush=True)
                    return False
                # 指数退避 + 抖动，避免一批请求同时重试又撞上限流
                await asyncio.sleep(1.2 * (attempt + 1) + random.random())
        return False


async def synth_all(items: list[tuple[str, str]], args: argparse.Namespace, index: dict) -> list[str]:
    """items: [(text, kind)]；返回失败文本列表。"""
    sem = asyncio.Semaphore(max(1, args.jobs))
    progress = Progress(len(items))
    failed: list[str] = []

    async def worker(text: str, kind: str) -> None:
        rate = args.word_rate if kind == "word" else args.sent_rate
        path = os.path.join(VOICE_DIR, key_of(text) + ".mp3")
        ok = await synth_one(text, path, args.voice, rate, sem, progress)
        if not ok:
            failed.append(text)

    try:
        await asyncio.gather(*(worker(t, k) for t, k in items))
    finally:
        progress.close()
    return failed


def cmd_synth(args: argparse.Namespace) -> None:
    if edge_tts is None:
        die("缺少依赖 edge-tts，请先执行：pip install edge-tts")

    corpus = collect_corpus(args.books)
    texts = corpus.texts
    index = load_index()
    os.makedirs(VOICE_DIR, exist_ok=True)

    # 决定这一轮要做什么
    queue: list[tuple[str, str]] = []
    for text, kind in sorted(texts.items(), key=lambda kv: (kv[1] != "word", kv[0])):
        if args.only == "words" and kind != "word":
            continue
        if args.only == "sentences" and kind != "sentence":
            continue
        key = index.get(text) or key_of(text)
        path = os.path.join(VOICE_DIR, key + ".mp3")
        if not args.force and is_valid_mp3(path):
            continue
        queue.append((text, kind))

    skip = len(texts) - len(queue)
    print(f"全库 {len(texts)} 段（词 {len(corpus.words)} / 句 {len(corpus.sentences)}）")
    print(f"已完好 {skip} 段，本轮待合成 {len(queue)} 段，音色 {args.voice}")
    if args.limit:
        queue = queue[: args.limit]
        print(f"--limit 生效，只做前 {len(queue)} 段")
    if not queue:
        print("没有需要合成的文本。")
        _refresh_index(texts, index, prune=args.prune)
        return

    if args.dry_run:
        for text, kind in queue[:15]:
            print(f"  [{kind[:4]}] {text}")
        if len(queue) > 15:
            print(f"  …… 共 {len(queue)} 段")
        return

    t0 = time.time()
    failed = asyncio.run(synth_all(queue, args, index))
    cost = time.time() - t0

    ok = len(queue) - len(failed)
    print(f"\n完成 {ok} 段，失败 {len(failed)} 段，耗时 {fmt_dur(cost)}"
          f"（{ok / cost:.1f} 段/秒）" if cost > 0 else "")

    _refresh_index(texts, index, prune=args.prune)

    if failed:
        fail_path = os.path.join(PACK_DIR, "failures.json")
        os.makedirs(PACK_DIR, exist_ok=True)
        with open(fail_path, "w", encoding="utf-8") as f:
            json.dump(failed, f, ensure_ascii=False, indent=1)
        print(f"失败清单已写入 {os.path.relpath(fail_path, ROOT)}")
        print("直接再跑一次 synth 即可只补失败的（已有文件会跳过）。")
        sys.exit(1)


def _refresh_index(texts: dict[str, str], index: dict, prune: bool = False) -> None:
    """按磁盘实际情况重写索引：只保留有完好文件的条目，顺便清孤儿。"""
    os.makedirs(VOICE_DIR, exist_ok=True)
    on_disk = {n[: -len(".mp3")] for n in os.listdir(VOICE_DIR) if n.endswith(".mp3")}

    fresh: dict[str, str] = {}
    missing = 0
    for text in texts:
        key = index.get(text) or key_of(text)
        if key in on_disk and is_valid_mp3(os.path.join(VOICE_DIR, key + ".mp3")):
            fresh[text] = key
        else:
            missing += 1

    referenced = set(fresh.values())
    orphans = sorted(on_disk - referenced)
    if prune:
        removed = 0
        for key in orphans:
            try:
                os.remove(os.path.join(VOICE_DIR, key + ".mp3"))
                removed += 1
            except OSError:
                pass
        orphans = []
        print(f"已永久删除孤儿音频 {removed} 个（不进回收站）")

    save_index(fresh)
    total = sum(
        os.path.getsize(os.path.join(VOICE_DIR, k + ".mp3"))
        for k in referenced
        if os.path.exists(os.path.join(VOICE_DIR, k + ".mp3"))
    )
    print(f"索引已更新：{len(fresh)} 条（{len(fresh) / max(1, len(texts)) * 100:.1f}% 覆盖），"
          f"{human(total)}")
    if missing:
        print(f"仍缺 {missing} 条，再跑一次 synth 补齐。")
    if orphans:
        print(f"另有 {len(orphans)} 个孤儿文件（教材里已不存在），可加 --prune 清除。")


# ---------------------------------------------------------------- verify


def cmd_verify(args: argparse.Namespace) -> None:
    corpus = collect_corpus(args.books)
    texts = corpus.texts
    index = load_index()

    problems = 0

    # 1. 索引 → 文件
    missing = []
    bad = []
    for text, key in index.items():
        if not re.fullmatch(r"[0-9a-f]{12}", str(key)):
            bad.append((text, key, "键名不是 12 位十六进制"))
            continue
        path = os.path.join(VOICE_DIR, key + ".mp3")
        if not os.path.exists(path):
            missing.append((text, key))
        elif not is_valid_mp3(path):
            bad.append((text, key, f"文件异常 {human(os.path.getsize(path))}"))

    # 2. 索引 → 教材文本（多余条目）
    extra = [t for t in index if t not in texts]

    # 3. 教材文本 → 索引（缺口）
    gaps_by_kind = {"word": [], "sentence": []}
    for text, kind in texts.items():
        if text not in index:
            gaps_by_kind[kind].append(text)

    # 4. 磁盘孤儿
    on_disk = {n[: -len(".mp3")] for n in os.listdir(VOICE_DIR) if n.endswith(".mp3")} \
        if os.path.isdir(VOICE_DIR) else set()
    orphans = sorted(on_disk - set(index.values()))

    print("=== 语音包一致性体检 ===")
    print(f"教材文本 {len(texts)} 条 / 索引 {len(index)} 条 / 磁盘 {len(on_disk)} 个文件")

    def report(title: str, items: list, problems_inc: int, show: int = 5) -> int:
        if not items:
            print(f"  [OK] {title}")
            return problems_inc
        print(f"  [!]  {title}：{len(items)} 条")
        for it in items[:show]:
            print(f"        {it}")
        if len(items) > show:
            print(f"        …… 另外 {len(items) - show} 条")
        return problems_inc + len(items)

    problems += report("索引指向的文件缺失", [f"{k}  {t[:40]!r}" for t, k in missing], 0)
    problems += report("文件损坏 / 键名非法", [f"{k}  {t[:40]!r}  {why}" for t, k, why in bad], 0)
    problems += report("索引里有教材已不存在的文本", [t[:60] for t in extra], 0)
    problems += report("教材文本没有音频（词）", gaps_by_kind["word"], 0)
    problems += report("教材文本没有音频（句）", gaps_by_kind["sentence"], 0)
    problems += report("磁盘上没有索引引用的孤儿文件", [k for k in orphans], 0)

    cover = (len(texts) - len(gaps_by_kind["word"]) - len(gaps_by_kind["sentence"])) / max(1, len(texts))
    print(f"\n覆盖率 {cover * 100:.2f}%")

    if orphans and args.prune:
        for key in orphans:
            try:
                os.remove(os.path.join(VOICE_DIR, key + ".mp3"))
            except OSError:
                pass
        print(f"已永久删除孤儿音频 {len(orphans)} 个（不进回收站）")
        problems -= len(orphans)

    if problems:
        print(f"\n共 {problems} 项待处理。跑 synth 补缺口，跑 verify --prune 清孤儿。")
        sys.exit(1)
    print("全部一致，没有发现问题。")


# ---------------------------------------------------------------- stats


def cmd_stats(args: argparse.Namespace) -> None:
    corpus = collect_corpus(args.books)
    texts = corpus.texts
    index = load_index()
    os.makedirs(VOICE_DIR, exist_ok=True)

    sizes: list[int] = []
    missing = 0
    for text in texts:
        key = index.get(text)
        path = os.path.join(VOICE_DIR, key + ".mp3") if key else None
        if path and os.path.exists(path):
            sizes.append(os.path.getsize(path))
        else:
            missing += 1

    print("=== 语音包统计 ===")
    print(f"教材文本   {len(texts)} 条（词 {len(corpus.words)} / 句 {len(corpus.sentences)}）")
    print(f"已生成     {len(sizes)} 条")
    print(f"缺口       {missing} 条")
    print(f"覆盖率     {len(sizes) / max(1, len(texts)) * 100:.2f}%")
    if sizes:
        print(f"总体积     {human(sum(sizes))}")
        print(f"单条均值   {human(sum(sizes) / len(sizes))}")
        print(f"单条区间   {human(min(sizes))} ~ {human(max(sizes))}")
    if os.path.isdir(PACK_DIR):
        packs = sorted(n for n in os.listdir(PACK_DIR) if n.endswith(".zip"))
        if packs:
            total = sum(os.path.getsize(os.path.join(PACK_DIR, n)) for n in packs)
            print(f"已打包     {len(packs)} 卷，{human(total)}")


# ---------------------------------------------------------------- pack


def _split_by_size(files: list[tuple[str, int]], limit_bytes: int) -> list[list[tuple[str, int]]]:
    """按累计字节切卷，单卷不超过 limit_bytes。limit_bytes<=0 表示不切。"""
    if limit_bytes <= 0:
        return [files]
    parts: list[list[tuple[str, int]]] = []
    cur: list[tuple[str, int]] = []
    cur_bytes = 0
    for item in files:
        if cur and cur_bytes + item[1] > limit_bytes:
            parts.append(cur)
            cur, cur_bytes = [], 0
        cur.append(item)
        cur_bytes += item[1]
    if cur:
        parts.append(cur)
    return parts


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def cmd_pack(args: argparse.Namespace) -> None:
    if not os.path.isdir(VOICE_DIR):
        die(f"没有音频目录 {VOICE_DIR}，先跑 synth")

    index = load_index()
    if not index:
        die("语音索引是空的，先跑 synth")

    # 只打包索引真正引用的文件，孤儿一律不进包
    pairs: list[tuple[str, int]] = []
    missing = 0
    for key in sorted(set(index.values())):
        path = os.path.join(VOICE_DIR, key + ".mp3")
        if os.path.exists(path):
            pairs.append((key, os.path.getsize(path)))
        else:
            missing += 1
    if missing:
        print(f"警告：索引里有 {missing} 个文件不存在，打包会跳过（先跑 synth 补齐）")
    if not pairs:
        die("一个可打包的音频都没有")

    out_dir = args.out or PACK_DIR
    os.makedirs(out_dir, exist_ok=True)
    total_bytes = sum(sz for _, sz in pairs)
    parts = _split_by_size(pairs, int(args.split_mb * 1024 * 1024))

    stamp = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    manifest = {
        "format": PACK_FORMAT,
        "version": PACK_VERSION,
        "generatedAt": stamp,
        "voice": args.voice,
        "wordRate": args.word_rate,
        "sentRate": args.sent_rate,
        "count": len(pairs),
        "bytes": total_bytes,
        "indexEntries": len(index),
        "parts": [],
    }

    print(f"打包 {len(pairs)} 段 / {human(total_bytes)}，分 {len(parts)} 卷 → "
          f"{os.path.relpath(out_dir, ROOT)}")

    for i, part in enumerate(parts, 1):
        suffix = f"-part{i}of{len(parts)}" if len(parts) > 1 else ""
        name = f"spellpal-voice{suffix}.zip"
        out_path = os.path.join(out_dir, name)
        part_bytes = sum(sz for _, sz in part)

        if os.path.exists(out_path):
            os.remove(out_path)  # 永久删除，不覆盖留残

        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_STORED, allowZip64=True) as z:
            for key, _ in part:
                z.write(os.path.join(VOICE_DIR, key + ".mp3"), f"voice/{key}.mp3")
            # 索引随包分发，解包方不必回头找仓库
            z.write(INDEX_PATH, "voice-index.json")
            z.writestr(
                "README.txt",
                "小拼手 SpellPal 离线语音包\n"
                f"生成时间：{stamp}\n"
                f"音色：{args.voice}\n"
                f"本卷 {len(part)} 段，共 {len(pairs)} 段 / 全部 {len(parts)} 卷\n"
                "用法：把 voice/*.mp3 放到应用目录的 voice/ 下，\n"
                "      voice-index.json 放到 src/data/ 后重新构建。\n",
            )

        digest = sha256_of(out_path)
        manifest["parts"].append({
            "name": name,
            "files": len(part),
            "bytes": part_bytes,
            "zipBytes": os.path.getsize(out_path),
            "sha256": digest,
        })
        print(f"  {name}  {len(part)} 段  {human(part_bytes)} → "
              f"{human(os.path.getsize(out_path))}")

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with open(os.path.join(out_dir, "SHA256SUMS.txt"), "w", encoding="utf-8") as f:
        for p in manifest["parts"]:
            f.write(f"{p['sha256']}  {p['name']}\n")

    print(f"清单 {os.path.relpath(os.path.join(out_dir, 'manifest.json'), ROOT)}")
    print(f"校验 {os.path.relpath(os.path.join(out_dir, 'SHA256SUMS.txt'), ROOT)}")
    print("（release/ 已在 .gitignore 里，语音包单独分发，不进仓库）")


# ---------------------------------------------------------------- CLI


def _common_args() -> argparse.ArgumentParser:
    """全局参数。子命令也要挂一份，否则 `synth --jobs 8` 这种写法解析不了。"""
    c = argparse.ArgumentParser(add_help=False)
    c.add_argument("--voice", default=DEFAULT_VOICE, help="edge-tts 音色")
    c.add_argument("--word-rate", default=DEFAULT_WORD_RATE, help="单词语速")
    c.add_argument("--sent-rate", default=DEFAULT_SENT_RATE, help="例句语速")
    c.add_argument("--jobs", "--concurrency", dest="jobs", type=int, default=6,
                   help="并发数，默认 6（太高会被限流）")
    c.add_argument("--books", nargs="*", help="只处理指定册（bookId，不带 .json）")
    c.add_argument("--prune", action="store_true", help="永久删除孤儿音频（不进回收站）")
    return c


def build_parser() -> argparse.ArgumentParser:
    common = _common_args()
    ap = argparse.ArgumentParser(
        prog="tts_pack.py",
        description="小拼手 SpellPal 离线语音包生成与打包",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="不带子命令时等价于 synth。",
        parents=[common],
    )

    sub = ap.add_subparsers(dest="cmd")

    p = sub.add_parser("collect", help="统计要合成多少段", parents=[common])
    p.set_defaults(func=cmd_collect)

    p = sub.add_parser("synth", help="批量合成 mp3（增量）", parents=[common])
    p.add_argument("--limit", type=int, default=0, help="只做前 N 段（试跑用）")
    p.add_argument("--only", choices=["words", "sentences"], help="只做词或只做句")
    p.add_argument("--force", action="store_true", help="忽略已有文件，全部重生成")
    p.add_argument("--dry-run", action="store_true", help="只打印计划，不真的合成")
    p.set_defaults(func=cmd_synth)

    p = sub.add_parser("verify", help="索引与文件一致性体检", parents=[common])
    p.set_defaults(func=cmd_verify)

    p = sub.add_parser("pack", help="打成分发音频包", parents=[common])
    p.add_argument("--split-mb", type=float, default=0, help="按 MB 切卷，0 表示单卷")
    p.add_argument("--out", help="输出目录，默认 release/voice-pack")
    p.set_defaults(func=cmd_pack)

    p = sub.add_parser("stats", help="覆盖率与体积统计", parents=[common])
    p.set_defaults(func=cmd_stats)

    p = sub.add_parser("all", help="synth → verify → pack", parents=[common])
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--split-mb", type=float, default=0)
    p.add_argument("--out")
    p.set_defaults(func=None)  # 特殊处理

    return ap


def main() -> None:
    # Windows 控制台 / 重定向到文件时都可能不是 UTF-8
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    ap = build_parser()
    args = ap.parse_args()

    # 不带子命令 = synth（兼容老的 python scripts/tts_pack.py --force）
    if not getattr(args, "cmd", None):
        args.limit = 0
        args.only = None
        args.force = False
        args.dry_run = False
        args.prune = False
        args.func = cmd_synth

    if args.cmd == "all":
        ns = argparse.Namespace(**vars(args))
        ns.only = None
        ns.force = False
        ns.dry_run = False
        ns.prune = True
        cmd_synth(ns)

        ns2 = argparse.Namespace(**vars(args))
        ns2.prune = True
        cmd_verify(ns2)

        ns3 = argparse.Namespace(**vars(args))
        cmd_pack(ns3)
        return

    args.func(args)


if __name__ == "__main__":
    main()
