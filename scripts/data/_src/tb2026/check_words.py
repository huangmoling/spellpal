# -*- coding: utf-8 -*-
"""联网复核词形：拿 Wiktionary（en）批量查每个词条是否存在。

只回答「这个词形在权威词典里有没有」，不评判释义与音标。
查不到的通常是：人名地名、缩写、词组（词典不单列）——需要人工判读。
"""
import json, os, re, sys, time, urllib.parse, urllib.request, glob

OUT = os.path.dirname(os.path.abspath(__file__))
UA = 'SpellPal-textbook-QA/1.0 (educational word-list check)'
API = 'https://en.wiktionary.org/w/api.php'


def fetch(titles, cache):
    need = [t for t in titles if t not in cache]
    for i in range(0, len(need), 40):
        chunk = need[i:i + 40]
        q = urllib.parse.urlencode({
            'action': 'query', 'prop': 'info', 'format': 'json', 'formatversion': '2',
            'titles': '|'.join(chunk), 'redirects': '1',
        })
        for attempt in range(4):
            try:
                req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
                data = json.load(urllib.request.urlopen(req, timeout=30))
                break
            except urllib.error.HTTPError as e:
                if attempt == 3:
                    raise
                # 429 是限流，退避要长；其他错误短退避
                time.sleep(25 * (attempt + 1) if e.code == 429 else 3 * (attempt + 1))
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(3 * (attempt + 1))
        pages = data.get('query', {}).get('pages', [])
        got = set()
        for p in pages:
            t = p.get('title', '').lower()
            got.add(t)
            cache[t] = not p.get('missing', False)
        for t in chunk:
            if t.lower() not in got:
                cache[t] = None
        time.sleep(2.5)


def norm(w):
    w = re.sub(r'\s*[(（][^)）]*[)）]', '', w)      # 去括号补充
    w = re.sub(r'\s*(sb|sth)\s*/\s*(sb|sth)', '', w)  # 词表里的 sb/sth 占位
    w = re.sub(r'\s+', ' ', w).strip()
    return w


def main(keys):
    cache_path = os.path.join(OUT, '.wikt-cache.json')
    cache = json.load(open(cache_path, encoding='utf-8')) if os.path.exists(cache_path) else {}
    report = {}
    for k in keys:
        d = json.load(open(os.path.join(OUT, k + '.words.json'), encoding='utf-8'))
        words = [w['word'] for w in d['words']]
        targets = sorted({norm(w) for w in words if norm(w) and re.search(r'[A-Za-z]', norm(w))})
        fetch(targets, cache)
        miss = [t for t in targets if cache.get(t) is False]
        report[k] = dict(total=len(words), checked=len(targets), missing=miss)
        print(f'{k:8s} 词条 {len(words):4d}  待查 {len(targets):4d}  词典无 {len(miss):3d}')
        if miss:
            print('    ' + ' | '.join(miss[:24]))
    json.dump(cache, open(cache_path, 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(report, open(os.path.join(OUT, '_wikt_report.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)


if __name__ == '__main__':
    ks = sys.argv[1:] or [os.path.basename(p)[:-11]
                          for p in sorted(glob.glob(os.path.join(OUT, '*.words.json')))]
    main(ks)
