# -*- coding: utf-8 -*-
"""从 Wiktionary 批量取英式（RP）音标，并归一成本项目沿用的学习者词典记法。

归一规则：
  ɛ → e           （学习者词典用 e，不用 ɛ）
  ɹ → r
  t͡ʃ/d͡ʒ → tʃ/dʒ   （去连音符）
  ɐ → ʌ
  ɚ → ə / ɝ → ɜː
  去非音节标记 ̯
  词尾 ə / ɑː / ɔː / ɜː 且拼写以 r/re 结尾 → 补 (r)，与 /ˈsentə(r)/ 一致
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.wikt-cache.json')
UA = 'SpellPal-IPA-fill/1.0 (educational word-list QA)'

# 取 RP 音标：优先 a=RP / a=UK，其次无方言标记的
RP = re.compile(r'\{\{IPA\|en\|([^}|]+)\|a=(?:RP|UK|GA\?)')
GEN = re.compile(r'\{\{IPA\|en\|([^}|]+)\}\}')
IPA_ITEM = re.compile(r'/([^/]+)/')


def fetch(titles):
    url = ('https://en.wiktionary.org/w/api.php?action=query&prop=revisions'
           '&rvprop=content&rvslots=main&format=json&formatversion=2&titles='
           + '|'.join(urllib.parse.quote(t) for t in titles))
    for attempt in range(1, 6):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            raw = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')
            return json.loads(raw)
        except urllib.error.HTTPError as e:
            wait = 25 * attempt if e.code == 429 else 4 * attempt
            print(f'  … HTTP {e.code}，{wait}s 后重试（{attempt}/5）', flush=True)
            time.sleep(wait)
        except Exception as e:
            if attempt == 5:
                raise
            print(f'  … {type(e).__name__}，{4 * attempt}s 后重试', flush=True)
            time.sleep(4 * attempt)
    raise RuntimeError('重试 5 次仍失败')


TPL = re.compile(r'\{\{IPA\|en\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}')


def _params(body):
    """按顶层 | 切参数（模板体里可能嵌 {{...}}）。"""
    out, depth, buf = [], 0, ''
    for ch in body:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        if ch == '|' and depth == 0:
            out.append(buf)
            buf = ''
        else:
            buf += ch
    out.append(buf)
    return out


def pick_rp(content):
    """从词条 wikitext 里抽英式音标，返回原始 /.../ 内文。

    Wiktionary 的 {{IPA|en|...}} 写法有四种坑：
      1. 参数顺序不固定，a=RP 可能在前也可能在后
      2. 方言标记可能是独立的 {{a|en|RP|AU}} 分组标题，不写在 IPA 模板里
      3. 同一个参数里音标后面跟着方括号变体，如 '/t͡ʃɑːns/ [t͡ʃʰɑːns]'
      4. 有些词根本没有 RP 标记，只有 'Southern England' / 'England,Wales'
    策略：先找带 RP/UK 的；找不到就退而取第一个给出的音标（Wiktionary 英式条目通常 RP 在前）。
    """
    first_any = None
    for m in TPL.finditer(content):
        ps = _params(m.group(1))
        tag = ' '.join(p[2:] for p in ps if p.startswith('a='))
        form = None
        for p in ps:
            hit = re.search(r'/([^/\[]+)/', p)
            if hit:
                body = hit.group(1).strip()
                if body and not body.startswith('-') and not body.endswith('-'):
                    form = body
                    break
        if not form:
            continue
        if re.search(r'\b(RP|UK)\b', tag):
            return form
        if first_any is None:
            first_any = form
    return first_any


def normalize(ipa, word):
    """Wiktionary 记法 → 本项目沿用的学习者词典（英式）记法。"""
    s = ipa
    # 可选 r 先全部去掉，最后按词尾规则统一补 (r)
    s = s.replace('(ɹ)', '').replace('(r)', '')
    s = s.replace('(ə.)', '(ə)')
    has_syllabic = bool(re.search(r'[lnm]\u0329', s))   # 成音节辅音 l̩ n̩ m̩
    s = s.replace('t͡ʃ', 'tʃ').replace('d͡ʒ', 'dʒ')
    s = s.replace('ɛ', 'e').replace('ɹ', 'r').replace('ɐ', 'ʌ')
    s = s.replace('ɚ', 'ə').replace('ɝ', 'ɜː')
    s = s.replace('\u032f', '').replace('g', '\u0261')   # 统一用 IPA 的 ɡ(U+0261)，与库内一致
    s = s.replace('ᵻ', 'ɪ').replace('ʉ', 'uː')
    s = s.replace('oʊ', 'əʊ')   # 美式 oʊ → 英式 əʊ
    s = s.replace('ɛə', 'eə')
    s = s.replace('.', '')
    # 残留的变音符号／音节点，都是排版噪声
    for a, b in (('d̪', 'd'), ('t̪', 't'), ('ä', 'a'), ('ʌɪ', 'aɪ'),
                 ('l̩', 'l'), ('n̩', 'n'), ('m̩', 'm'), ('ɪ̈', 'ɪ'), ('ʊ̈', 'ʊ')):
        s = s.replace(a, b)
    # 词尾补 (r)：拼写以 r / re 结尾，音标收在元音上
    if re.search(r'(?:r|re)$', word, re.I) and re.search(r'(ə|ɑː|ɔː|ɜː)$', s):
        s = s + '(r)'
    # 单音节词不加主重音，与库内 /haɪ/ /neɪm/ 的写法一致
    if not has_syllabic:
        vowels = re.findall(r'(aɪ|eɪ|ɔɪ|aʊ|əʊ|ɪə|eə|ʊə|ɑː|ɔː|ɜː|iː|uː|æ|e|ɪ|ɒ|ʌ|ʊ|ə|i|u)', s)
        if len(vowels) <= 1:
            s = s.replace('ˈ', '')
    return '/' + s + '/'


def main():
    words = [w.strip() for w in sys.argv[1:]] or []
    cache = {}
    if os.path.exists(CACHE):
        cache = json.load(open(CACHE, encoding='utf-8'))
    todo = [w for w in words if not cache.get(w.lower())]
    print(f'待查 {len(todo)} 条（缓存 {len(cache)} 条）', flush=True)
    B = 10
    for i in range(0, len(todo), B):
        chunk = todo[i:i + B]
        j = fetch([w.replace(' ', '_') for w in chunk])
        got = {}
        for p in j.get('query', {}).get('pages', []):
            title = p.get('title', '').replace('_', ' ')
            if p.get('missing'):
                got[title.lower()] = None
                continue
            content = p.get('revisions', [{}])[0].get('slots', {}).get('main', {}).get('content', '')
            got[title.lower()] = pick_rp(content)
        for w in chunk:
            v = got.get(w.lower())
            cache[w.lower()] = v if isinstance(v, str) and v else None
        print(f'  {i + len(chunk)}/{len(todo)}', flush=True)
        time.sleep(1.5)
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    ok = sum(1 for w in words if cache.get(w.lower()))
    print(f'拿到 RP 音标 {ok}/{len(words)}')


if __name__ == '__main__':
    main()
