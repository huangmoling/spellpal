/**
 * 功能自测：模拟真实键盘事件打完整个单元，验证状态机与错题本写入。
 *   electron scripts/verify.cjs
 *
 * 练习顺序是「一个单词、一个句子」交替，所以队列长度 = 本单元词数 + 句数。
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.disableHardwareAcceleration()

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
}

app.on('ready', async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    backgroundColor: '#0B0E13',
    webPreferences: { offscreen: true, preload: path.join(__dirname, '..', 'electron', 'preload.cjs') },
  })
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await new Promise((r) => setTimeout(r, 1200))
  const run = (c) => win.webContents.executeJavaScript(c)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  /* 干净环境 */
  await run(`localStorage.clear(); true`)
  await run(`location.reload(); true`)
  await wait(1500)

  const s0 = await run(`window.__spellpal.getState().phase`)
  check('初始处于书架', s0 === 'idle', `phase=${s0}`)

  /* 虚拟键盘默认关（用户要求：要看的人自己到设置里打开） */
  const kb = await run(`window.__spellpal.getState().kbOn`)
  check('虚拟键盘默认关闭', kb === false, `kbOn=${kb}`)
  console.log('[1] 初始状态 ok')

  /* 进入 Unit 1 */
  await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('继续练习'));
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(600)

  const kbVisible = await run(`!!document.querySelector('[data-kb]')`)
  check('练习页默认不渲染虚拟键盘', kbVisible === false, `visible=${kbVisible}`)

  const s1 = await run(`(() => {
    const s = window.__spellpal.getState();
    return {
      phase: s.phase, index: s.index, tokenIndex: s.tokenIndex,
      book: s.book && s.book.id, unitNo: s.unitNo,
      total: s.items.length,
      words: s.book.words.filter(w => w.unit === s.unitNo).length,
      sents: s.book.sentences.filter(x => x.unit === s.unitNo).length,
      kinds: s.items.map(i => i.kind || 'sentence'),
    };
  })()`)
  check(
    '点单元后进入练习',
    s1.phase === 'typing',
    JSON.stringify({ phase: s1.phase, total: s1.total }),
  )
  check(
    '本轮项数 = 本单元单词 + 句子',
    s1.total === s1.words + s1.sents,
    `total=${s1.total} words=${s1.words} sents=${s1.sents}`,
  )
  /* 交替：每条例句都紧跟在某个单词后面，从第一个词开始 */
  check(
    '每条例句都紧跟在单词后面',
    s1.kinds[0] === 'word' &&
      s1.kinds.every((k, i) => k !== 'sentence' || (i > 0 && s1.kinds[i - 1] === 'word')),
    JSON.stringify(s1.kinds),
  )
  check(
    '例句紧跟在单词上，不堆在队尾',
    s1.sents === 0 || s1.kinds.indexOf('sentence') <= 3,
    JSON.stringify(s1.kinds.slice(0, 5)),
  )
  check('起始在第一个词', s1.tokenIndex === 0 && s1.index === 0)
  console.log('[2] 进入练习 ok', JSON.stringify({ total: s1.total, words: s1.words }))

  const press = async (k) => {
    await run(
      `window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`,
    )
  }

  /* 标点：顺手打出句号不应前进，也不该算错 */
  await press('.')
  await wait(120)
  const sp0 = await run(
    `(() => { const s = window.__spellpal.getState(); return { typed: s.typed, wrong: s.wrongItemIds.length, tk: s.tokenIndex }; })()`,
  )
  check(
    '打标点不算错也不前进',
    sp0.typed === '' && sp0.wrong === 0 && sp0.tk === 0,
    JSON.stringify(sp0),
  )

  /* 空格 / 回车两个「逃避键」默认关闭：按下去既不能跳词，也不能跳句 */
  await press(' ')
  await press('Enter')
  await wait(220)
  const escGuard = await run(
    `(() => { const s = window.__spellpal.getState(); return { idx: s.index, tk: s.tokenIndex, typed: s.typed, wrong: s.wrongItemIds.length }; })()`,
  )
  check(
    '空格/回车默认不生效（词没打完不能跳）',
    escGuard.idx === 0 && escGuard.tk === 0 && escGuard.typed === '' && escGuard.wrong === 0,
    JSON.stringify(escGuard),
  )

  /* 打开「回车跳过」后，回车才真的能跳到下一项 */
  await run(`window.__spellpal.setState({ enterSkip: true }); true`)
  await press('Enter')
  await wait(220)
  const skipped = await run(
    `(() => { const s = window.__spellpal.getState(); return { idx: s.index, wrong: s.wrongItemIds.length }; })()`,
  )
  check('设置里打开后回车可跳句', skipped.idx === 1 && skipped.wrong >= 1, JSON.stringify(skipped))

  /* 复位，后面的断言都假设从第 1 项第一个字符开始 */
  await run(
    `window.__spellpal.setState({ index: 0, tokenIndex: 0, typed: '', wrongTokenIdx: [], wrongItemIds: [], enterSkip: false }); true`,
  )
  await wait(180)

  /* 取当前项全部待敲字符（撇号、连字符、标点都不算） */
  const charsOfItem = () =>
    run(`
      (() => {
        const s = window.__spellpal.getState();
        const item = s.items[s.index];
        const SKIP = new Set(["'", '\\u2019', '-', '.', ',', '?', '!', ';', ':', '"', '\\u201c', '\\u201d', '(', ')', '\\u2026']);
        const out = [];
        for (const t of item.tokens) {
          for (const c of [...t.en]) if (!SKIP.has(c)) out.push(c);
        }
        return out;
      })()
    `)

  /* 第一轮：全部打对。每项打完后必须按空格才进下一项 */
  let guard = 0
  let heldChecked = false
  let stageSwitchOk = null
  while (guard < 60) {
    guard += 1
    const st = await run(
      `(() => { const s = window.__spellpal.getState(); return s.phase + '|' + s.index + '|' + (s.items[s.index] ? (s.items[s.index].kind || 'sentence') : ''); })()`,
    )
    const [ph, idx, kindNow] = st.split('|')
    if (ph === 'done') break
    console.log(`[3.${guard}] 打第 ${Number(idx) + 1} 项（${kindNow === 'word' ? '单词' : '句子'}）`)

    /* 每次从单词切到句子都记一次，用来确认没有「先打完所有单词」 */
    if (stageSwitchOk === null && kindNow === 'sentence') stageSwitchOk = Number(idx)

    const chars = await charsOfItem()
    for (const c of chars) {
      await press(c)
      await wait(8)
    }
    await wait(240)
    if (!heldChecked) {
      const held = await run(
        `(() => { const s = window.__spellpal.getState(); return { idx: s.index, done: s.completed }; })()`,
      )
      check('拼完不自动跳，等空格', held.idx === 0 && held.done === true, JSON.stringify(held))
      heldChecked = true
    }
    await press(' ')
    await wait(200)
  }
  console.log('[3] 打完整单元')
  check(
    '第一次切到句子时还在队列前段（不是整单元词打完才上句子）',
    typeof stageSwitchOk === 'number' && stageSwitchOk <= 3,
    `firstSentenceIndex=${stageSwitchOk}`,
  )

  const s2 = await run(`(() => { const s = window.__spellpal.getState(); return {
    phase: s.phase, index: s.index,
    outcomes: s.outcomes, wrong: s.wrongItemIds,
    srs: JSON.parse(localStorage.getItem('spellpal:srs') || '{}'),
    progress: JSON.parse(localStorage.getItem('spellpal:progress') || '{}')
  }; })()`)
  check('全部打对后进入结果页', s2.phase === 'done', `phase=${s2.phase} index=${s2.index}`)
  const allClean = Object.values(s2.outcomes).every((v) => v === 'clean')
  check('每项裁定都是 clean', allClean, JSON.stringify(s2.outcomes))
  check('全对不进错题本', Object.keys(s2.srs).length === 0, `srs=${Object.keys(s2.srs).length}`)
  check(
    '进度已落盘',
    !!s2.progress['pep-3start-3a#1'] && s2.progress['pep-3start-3a#1'].acc === 100,
    JSON.stringify(s2.progress['pep-3start-3a#1'] || null),
  )

  /* 第二轮：故意打错第一个字母，验证该项进错题本 */
  await run(`localStorage.removeItem('spellpal:srs'); true`)
  await run(`
    (() => {
      const s = window.__spellpal.getState();
      s.startUnit(s.book, 1);
      return true;
    })()
  `)
  await wait(300)

  const firstChars = await charsOfItem()
  await press('z'.toLowerCase() === firstChars[0].toLowerCase() ? 'q' : 'z')
  await wait(200)
  const s3 = await run(`(() => { const s = window.__spellpal.getState(); return {
    wrong: s.wrongItemIds, typed: s.typed, tokenIndex: s.tokenIndex, index: s.index
  }; })()`)
  check('打错不前进', s3.typed === '' && s3.tokenIndex === 0 && s3.index === 0, JSON.stringify(s3))
  check('打错的项被记下', s3.wrong.length === 1, JSON.stringify(s3.wrong))

  /* 打完这一项，再跳过剩下的，进结果页 */
  for (const c of firstChars) {
    await press(c)
    await wait(12)
  }
  await wait(360)
  for (let i = 0; i < 60; i++) {
    const st = await run(`window.__spellpal.getState().phase`)
    if (st === 'done') break
    await run(`window.__spellpal.getState().skipSentence(); true`)
    await wait(40)
  }
  await wait(900)

  const s4 = await run(`(() => { const s = window.__spellpal.getState(); return {
    phase: s.phase, srs: JSON.parse(localStorage.getItem('spellpal:srs') || '{}')
  }; })()`)
  const cardIds = Object.keys(s4.srs)
  check('结果页已生成', s4.phase === 'done')
  check('错项写入错题本', cardIds.length >= 1, `cards=${cardIds.length}`)
  const card = s4.srs[cardIds[0]]
  check(
    '错题卡结构完整（有中文、英文、id）',
    !!card && typeof card.en === 'string' && typeof card.cn === 'string' && !!card.itemId,
    card ? `${card.cn} / ${card.en}` : 'none',
  )

  /* 词组：pocket money 这种带空格的词条必须拆成两块，否则空格键进不了下一块，整题卡死 */
  const multi = await run(`
    (() => {
      const list = window.__spellpalBooks || [];
      const b = list.find((x) => x.id === 'pep-6start-6a');
      if (!b) return { ok: false, why: 'no-book' };
      const w = b.words.find((x) => x.unit === 1 && /pocket money/i.test(x.word));
      if (!w) return { ok: false, why: 'no-word' };
      const s = window.__spellpal.getState();
      s.startUnit(b, 1);
      const st = window.__spellpal.getState();
      const idx = st.items.findIndex((i) => i.id === 'w:' + w.id);
      window.__spellpal.setState({ index: idx, tokenIndex: 0, typed: '' });
      const item = window.__spellpal.getState().items[idx];
      return { ok: true, idx, tokens: item.tokens.map((t) => t.en), kind: item.kind };
    })()
  `)
  check(
    '词组拆成多个词块（pocket | money）',
    multi.ok && multi.tokens.length === 2 && multi.tokens.every((x) => !/\s/.test(x)),
    JSON.stringify(multi),
  )

  if (multi.ok) {
    const [a, b] = multi.tokens
    for (const c of [...a]) {
      await press(c)
      await wait(6)
    }
    const mid = await run(
      `(() => { const s = window.__spellpal.getState(); return { tk: s.tokenIndex, typed: s.typed, done: s.completed }; })()`,
    )
    check('打完 pocket 自动跳到 money（不卡在空格上）', mid.tk === 1 && mid.typed === '', JSON.stringify(mid))
    for (const c of [...b]) {
      await press(c)
      await wait(6)
    }
    await wait(200)
    const end = await run(
      `(() => { const s = window.__spellpal.getState(); return { tk: s.tokenIndex, done: s.completed }; })()`,
    )
    check('词组整条能拼完', end.tk === 1 && end.done === true, JSON.stringify(end))
    await press(' ')
    await wait(150)
  }

  /* 错题本入口 */
  await run(`window.__spellpal.getState().backToShelf(); true`)
  await wait(500)
  const reviewOk = await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('开始复习') || (x.textContent||'').includes('全部复习'));
      if (!b) return 'no-button';
      b.click(); return 'clicked';
    })()
  `)
  await wait(600)
  const s5 = await run(
    `(() => { const s = window.__spellpal.getState(); return { phase: s.phase, kind: s.kind, q: s.items.length }; })()`,
  )
  check(
    '能从错题本进入复习',
    reviewOk === 'clicked' && s5.kind === 'review' && s5.q >= 1,
    JSON.stringify({ reviewOk, ...s5 }),
  )

  /* 关窗二次确认：主进程发询问 → 弹框 → Esc 取消 */
  const hasApi = await run(`typeof window.spellpal?.onAskClose === 'function'`)
  check('渲染层拿到关窗回调', hasApi === true, `api=${hasApi}`)
  win.webContents.send('app:ask-close')
  await wait(500)
  const quitShown = await run(`!!document.querySelector('[data-quit-modal]')`)
  check('关闭软件会先弹确认框', quitShown === true, `modal=${quitShown}`)
  await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await wait(400)
  const quitGone = await run(`!!document.querySelector('[data-quit-modal]')`)
  check('按 Esc 取消退出', quitGone === false, `modal=${quitGone}`)

  /* ---------------- 少儿守护 ---------------- */
  await run(`window.__spellpal.getState().backToShelf(); true`)
  await wait(300)

  const g0 = await run(`window.__spellpal.getState().guardOn`)
  check('少儿守护默认关闭', g0 === false, `guardOn=${g0}`)

  /* 从设置界面走一遍：常规 → 守护 → 开 → 设密码 → 再输一次 → 选时长 */
  const opened = await run(`
    (() => {
      const b = document.querySelector('button[title="设置"]');
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(500)
  await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').trim() === '守护');
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(300)
  await run(`
    (() => {
      const b = document.querySelector('button[role="switch"][aria-label="少儿守护"]');
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(400)
  const setupShown = await run(`!!document.querySelector('[data-guard-modal] [data-pin-input]')`)
  check('首次开启会要求设密码', opened === true && setupShown === true, `setup=${setupShown}`)

  for (const c of ['1', '2', '3', '4', '5', '6']) {
    await press(c)
    await wait(40)
  }
  await wait(250)
  for (const c of ['1', '2', '3', '4', '5', '6']) {
    await press(c)
    await wait(40)
  }
  await wait(250)
  const atMinutes = await run(`!!document.querySelector('[data-guard-modal] input[type=range]')`)
  check('两次密码一致后进入时长设置', atMinutes === true, `slider=${atMinutes}`)
  await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('开启少儿守护'));
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(500)

  const g1 = await run(`(() => {
    const s = window.__spellpal.getState();
    return { on: s.guardOn, hash: s.guardPinHash, min: s.guardMinutes,
             raw: localStorage.getItem('spellpal:guard-pin') || '' };
  })()`)
  check('设置完成即开启守护', g1.on === true && g1.min >= 10, JSON.stringify({ on: g1.on, min: g1.min }))
  check('密码以散列保存，不存明文', g1.hash.startsWith('g1:') && !g1.raw.includes('123456'), g1.raw)

  const pinOk = await run(
    `[window.__spellpal.getState().verifyPin('000000'), window.__spellpal.getState().verifyPin('123456')]`,
  )
  check('错误密码被拒绝、正确密码通过', pinOk[0] === false && pinOk[1] === true, JSON.stringify(pinOk))

  /* 到点锁定：把额度调成 10 分钟再灌满 */
  await run(`window.__spellpal.getState().setGuardMinutes(10); true`)
  await run(`window.__spellpal.getState().addGuardUsage(600); true`)
  await wait(400)
  const locked = await run(`(() => {
    const s = window.__spellpal.getState();
    return { locked: s.guardLocked, used: s.guardUsedSec, lock: !!document.querySelector('[data-guard-lock]') };
  })()`)
  check('学满时长后锁定并盖住界面', locked.locked === true && locked.lock === true, JSON.stringify(locked))

  /* 家长密码解锁 +10 分钟 */
  await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('家长解锁'));
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(400)
  for (const c of ['1', '2', '3', '4', '5', '6']) {
    await press(c)
    await wait(40)
  }
  await wait(500)
  const unlocked = await run(`(() => {
    const s = window.__spellpal.getState();
    return { locked: s.guardLocked, bonus: s.guardBonusSec, lock: !!document.querySelector('[data-guard-lock]') };
  })()`)
  check(
    '输密码后加 10 分钟并解锁',
    unlocked.locked === false && unlocked.bonus === 600 && unlocked.lock === false,
    JSON.stringify(unlocked),
  )

  /* 守护开着时，关软件要先过密码 */
  win.webContents.send('app:ask-close')
  await wait(400)
  await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').trim() === '退出软件');
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(400)
  const quitPin = await run(
    `!!document.querySelector('[data-guard-modal] [data-pin-input]') && !!document.querySelector('[data-quit-modal]')`,
  )
  check('守护开启后退出软件要输密码', quitPin === true, `pin=${quitPin}`)
  await press('Escape')
  await wait(250)
  await press('Escape')
  await wait(250)

  const g2 = await run(`!!document.querySelector('[data-quit-modal]') || !!document.querySelector('[data-guard-modal]')`)
  check('取消后弹窗全部收起', g2 === false, `still=${g2}`)

  /* 关守护（已解锁状态由设置页负责，这里直接验状态机） */
  await run(`
    (() => {
      const s = window.__spellpal.getState();
      s.setSettingsOpen(false);
      s.disableGuard();
      return true;
    })()
  `)
  await wait(300)
  const g3 = await run(`(() => {
    const s = window.__spellpal.getState();
    return { on: s.guardOn, locked: s.guardLocked, lock: !!document.querySelector('[data-guard-lock]') };
  })()`)
  check('关闭守护后解除锁定', g3.on === false && g3.locked === false && g3.lock === false, JSON.stringify(g3))

  console.log('\n================ 功能自测 ================')
  let pass = 0
  for (const r of results) {
    if (r.ok) pass += 1
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  <<< ' + r.detail}`)
  }
  console.log(`\n${pass}/${results.length} 通过`)
  app.exit(pass === results.length ? 0 : 1)
})
