/**
 * 功能自测：模拟真实键盘事件打完整个单元，验证状态机与错题本写入。
 *   electron scripts/verify.cjs
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
    webPreferences: { offscreen: true },
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
  console.log('[1] 初始状态 ok')

  /* 进入 Unit 1 */
  await run(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('继续练习'));
      if (b) b.click(); return !!b;
    })()
  `)
  await wait(600)

  const s1 = await run(`(() => { const s = window.__spellpal.getState(); return {
    phase: s.phase, queue: s.queue, index: s.index, tokenIndex: s.tokenIndex,
    book: s.book && s.book.id, unitNo: s.unitNo, total: s.queue.length
  }; })()`)
  check('点单元后进入练习', s1.phase === 'typing', JSON.stringify({ phase: s1.phase, total: s1.total }))
  check('队列按句组织（Unit1 应为 8 句）', s1.total === 8, `total=${s1.total}`)
  check('起始在第一个词', s1.tokenIndex === 0 && s1.index === 0)
  console.log('[2] 进入练习 ok', JSON.stringify({ total: s1.total }))

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

  /* 打开「回车跳过」后，回车才真的能跳到下一句 */
  await run(`window.__spellpal.setState({ enterSkip: true }); true`)
  await press('Enter')
  await wait(220)
  const skipped = await run(
    `(() => { const s = window.__spellpal.getState(); return { idx: s.index, wrong: s.wrongItemIds.length }; })()`,
  )
  check('设置里打开后回车可跳句', skipped.idx === 1 && skipped.wrong >= 1, JSON.stringify(skipped))

  /* 复位，后面的断言都假设从第 1 句第一个词开始 */
  await run(
    `window.__spellpal.setState({ index: 0, tokenIndex: 0, typed: '', wrongTokenIdx: [], wrongItemIds: [], enterSkip: false }); true`,
  )
  await wait(180)

  /* 取当前句全部待敲字符（撇号、连字符、标点都不算） */
  const charsOfSentence = () =>
    run(`
      (() => {
        const s = window.__spellpal.getState();
        const sen = s.book.sentences.find(x => x.id === s.queue[s.index]);
        const SKIP = new Set(["'", '\\u2019', '-', '.', ',', '?', '!', ';', ':', '"', '\\u201c', '\\u201d', '(', ')', '\\u2026']);
        const out = [];
        for (const t of sen.tokens) {
          for (const c of [...t.en]) if (!SKIP.has(c)) out.push(c);
        }
        return out;
      })()
    `)

  /* 第一轮：全部打对 */
  let guard = 0
  while (guard < 40) {
    guard += 1
    const st = await run(`(() => { const s = window.__spellpal.getState(); return s.phase + '|' + s.index + '|' + s.tokenIndex; })()`)
    const [ph, idx] = st.split('|')
    if (ph === 'done') break
    console.log(`[3.${guard}] 打第 ${Number(idx) + 1} 句`)
    const chars = await charsOfSentence()
    for (const c of chars) {
      await press(c)
      await wait(8)
    }
    await wait(320)
  }
  console.log('[3] 打完整单元')

  const s2 = await run(`(() => { const s = window.__spellpal.getState(); return {
    phase: s.phase, index: s.index,
    outcomes: s.outcomes, wrong: s.wrongItemIds,
    srs: JSON.parse(localStorage.getItem('spellpal:srs') || '{}'),
    progress: JSON.parse(localStorage.getItem('spellpal:progress') || '{}')
  }; })()`)
  check('全部打对后进入结果页', s2.phase === 'done', `phase=${s2.phase} index=${s2.index}`)
  const allClean = Object.values(s2.outcomes).every((v) => v === 'clean')
  check('每句裁定都是 clean', allClean, JSON.stringify(s2.outcomes))
  check('全对不进错题本', Object.keys(s2.srs).length === 0, `srs=${Object.keys(s2.srs).length}`)
  check(
    '进度已落盘',
    !!s2.progress['pep-3start-3a#1'] && s2.progress['pep-3start-3a#1'].acc === 100,
    JSON.stringify(s2.progress['pep-3start-3a#1'] || null),
  )

  /* 第二轮：故意打错第一个字母，验证该句进错题本 */
  await run(`localStorage.removeItem('spellpal:srs'); true`)
  await run(`
    (() => {
      const s = window.__spellpal.getState();
      s.startUnit(s.book, 1);
      return true;
    })()
  `)
  await wait(300)

  const firstChars = await charsOfSentence()
  await press('z'.toLowerCase() === firstChars[0].toLowerCase() ? 'q' : 'z')
  await wait(200)
  const s3 = await run(`(() => { const s = window.__spellpal.getState(); return {
    wrong: s.wrongItemIds, typed: s.typed, tokenIndex: s.tokenIndex, index: s.index
  }; })()`)
  check('打错不前进', s3.typed === '' && s3.tokenIndex === 0 && s3.index === 0, JSON.stringify(s3))
  check('打错的句子被记下', s3.wrong.length === 1, JSON.stringify(s3.wrong))

  /* 打完这一句，再跳过剩下的，进结果页 */
  for (const c of firstChars) {
    await press(c)
    await wait(12)
  }
  await wait(360)
  for (let i = 0; i < 10; i++) {
    const st = await run(`window.__spellpal.getState().phase`)
    if (st === 'done') break
    await run(`window.__spellpal.getState().skipSentence(); true`)
    await wait(60)
  }
  await wait(900)

  const s4 = await run(`(() => { const s = window.__spellpal.getState(); return {
    phase: s.phase, srs: JSON.parse(localStorage.getItem('spellpal:srs') || '{}')
  }; })()`)
  const cardIds = Object.keys(s4.srs)
  check('结果页已生成', s4.phase === 'done')
  check('错句写入错题本', cardIds.length >= 1, `cards=${cardIds.length}`)
  const card = s4.srs[cardIds[0]]
  check(
    '错题卡是句子结构',
    !!card && typeof card.en === 'string' && typeof card.cn === 'string' && !!card.itemId,
    card ? `${card.cn} / ${card.en}` : 'none',
  )

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
  const s5 = await run(`(() => { const s = window.__spellpal.getState(); return { phase: s.phase, kind: s.kind, q: s.queue.length }; })()`)
  check('能从错题本进入复习', reviewOk === 'clicked' && s5.kind === 'review' && s5.q >= 1, JSON.stringify({ reviewOk, ...s5 }))

  console.log('\n================ 功能自测 ================')
  let pass = 0
  for (const r of results) {
    if (r.ok) pass += 1
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  <<< ' + r.detail}`)
  }
  console.log(`\n${pass}/${results.length} 通过`)
  app.exit(pass === results.length ? 0 : 1)
})
