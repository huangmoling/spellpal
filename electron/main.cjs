const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const isDev = process.env.NODE_ENV === 'development'
/** 截图模式：SPELLPAL_SHOT=<png 路径> 时，加载页面后截图退出（开发/CI 用） */
const shotPath = process.env.SPELLPAL_SHOT || ''
const offscreen = process.env.SPELLPAL_OFFSCREEN === '1'

const logFile = shotPath ? path.join(path.dirname(shotPath), 'shot.log') : ''
const log = (m) => {
  if (!logFile) return
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${m}\n`)
  } catch {}
}

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  log('createWindow offscreen=' + offscreen)
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0B0E13',
    frame: false,
    show: !shotPath,
    autoHideMenuBar: true,
    title: '小拼手 SpellPal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      offscreen,
    },
  })

  mainWindow.once('ready-to-show', () => {
    log('ready-to-show')
    if (!shotPath) mainWindow?.show()
  })

  if (isDev) {
    log('loadURL dev')
    mainWindow.loadURL('http://localhost:5173')
  } else {
    log('loadFile dist')
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (shotPath) {
    mainWindow.webContents.once('did-finish-load', async () => {
      log('did-finish-load')
      const action = process.env.SPELLPAL_ACTION || ''
      const wc = mainWindow.webContents
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      const run = (code) => wc.executeJavaScript(code)
      const clickText = async (needles) => {
        const list = JSON.stringify(needles)
        const hit = await run(`
          (() => {
            const want = ${list};
            const b = [...document.querySelectorAll('button')].find((x) => {
              const t = x.textContent || '';
              return want.some((w) => t.includes(w));
            });
            if (b) b.click();
            return b ? b.textContent.trim().slice(0, 24) : null;
          })()
        `)
        log('click ' + JSON.stringify(needles) + ' -> ' + hit)
        return hit
      }

      try {
        await wait(900)

        /* 1) 造数据：进度 / 错题本 */
        if (action === 'completed' || action.startsWith('review')) {
          await run(`
            (() => {
              const pad = (n) => String(n).padStart(2, '0');
              const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
              const today = new Date();
              const days = [0, 1, 2].map((i) => {
                const d = new Date(today); d.setDate(d.getDate() - i); return dstr(d);
              });
              const prog = {
                'pep-3start-3a#1': { done: 15, acc: 93, at: Date.now(), times: 2 },
                'pep-3start-3a#2': { done: 19, acc: 74, at: Date.now(), times: 1 }
              };
              if (${action.startsWith('review')}) {
                const now = Date.now();
                const cards = [
                  ['pep-3start-3a-u1-s01','Nice to meet you.','见到你很高兴！',1,0,2],
                  ['pep-3start-3a-u1-s05','We can share.','我们可以一起分享。',1,0,1],
                  ['pep-3start-3a-u2-s02','I have a big family.','我有一个大家庭。',2,1,3],
                  ['pep-3start-3a-u3-s01','I like animals.','我喜欢动物。',3,0,4]
                ];
                const m = {};
                for (const [sid, en, cn, unit, box, wrong] of cards) {
                  m['pep-3start-3a#' + sid] = {
                    id: 'pep-3start-3a#' + sid, bookId: 'pep-3start-3a',
                    itemId: sid, en, cn, unit, box, wrong, right: 1,
                    due: now - 1000, last: now - 86400000
                  };
                }
                localStorage.setItem('spellpal:srs', JSON.stringify(m));
              }
              localStorage.setItem('spellpal:progress', JSON.stringify(prog));
              localStorage.setItem('spellpal:days', JSON.stringify(days));
              localStorage.setItem('spellpal:last-unit', '3');
              return true;
            })()
          `)
          await run('location.reload(); true')
          await wait(2200)
        }

        /* 2) 切册 + 进入会话 */
        if (action.startsWith('book')) {
          const LABELS = {
            phonics: '拼读起步',
            '1a': '一年级上册',
            '1b': '一年级下册',
            '3a': '三年级上册',
            '3b': '三年级下册',
            '4a': '四年级上册',
            '4b': '四年级下册',
            '5a': '五年级上册',
            '6a': '六年级上册',
          }
          const key = action.replace(/^book/, '').split(/[-_]/)[0]
          const label = LABELS[key] || '三年级上册'
          await clickText([label])
          await wait(400)
          const unitNo = Number(process.env.SPELLPAL_UNIT || 0)
          if (unitNo) {
            const hit = await run(`
              (() => {
                const list = window.__spellpalBooks || [];
                const st = window.__spellpal.getState();
                const b = st.book || list.find((x) => x.shortTitle === ${JSON.stringify(label)});
                if (!b) return 'no-book';
                st.startUnit(b, ${unitNo});
                return b.shortTitle + ' U' + ${unitNo};
              })()
            `)
            log('startUnit -> ' + hit)
            await wait(600)
          }
        }
        if (action.startsWith('book') && !action.includes('-')) {
          // 只切册，停在书架
        } else if (action.startsWith('review')) {
          await clickText(['开始复习', '全部复习'])
        } else if (action) {
          await clickText(['继续练习', '再练一次'])
        }
        if (action) await wait(700)

        /* 4) 模拟打字 */
        if (action.includes('typed') || action.includes('wrong') || action.includes('whole')) {
          const seq = await run(`
            (() => {
              const s = window.__spellpal.getState();
              const sentence = s.book.sentences.find((x) => x.id === s.queue[s.index]);
              const token = sentence.tokens[s.tokenIndex];
              return [...token.en].filter((c) => c !== "'" && c !== '\u2019' && c !== '-');
            })()
          `)
          log('token chars=' + JSON.stringify(seq))
          const keys = action.includes('whole')
            ? seq || []
            : (seq || []).slice(0, Math.max(1, (seq || []).length - 1))
          for (const k of keys) {
            await run(`window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`)
            await wait(130)
          }
          if (action.includes('wrong')) {
            await run(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',bubbles:true}))`)
            await wait(150)
          } else {
            await wait(600)
          }
        }

        /* 5) 结果页 */
        if (action === 'result') {
          await run(`
            (() => {
              const s = window.__spellpal;
              const st = s.getState();
              const wrong = st.queue.slice(0, 3);
              const outcomes = {};
              st.queue.forEach((id, i) => { outcomes[id] = i < 3 ? 'rough' : 'clean'; });
              s.setState({ phase: 'done', startedAt: Date.now() - 96000,
                           finishedAt: Date.now(), wrongItemIds: wrong, outcomes });
              return true;
            })()
          `)
          await wait(1400)
        }

        await wait(500)
        const img = await wc.capturePage()
        fs.writeFileSync(shotPath, img.toPNG())
        log('saved ' + JSON.stringify(img.getSize()))
      } catch (e) {
        log('ERR ' + (e && e.stack))
      }
      app.exit(0)
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

process.on('uncaughtException', (e) => log('UNCAUGHT ' + (e && e.stack)))

app.whenReady().then(() => {
  log('app ready')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
ipcMain.on('win:maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (!w) return
  if (w.isMaximized()) w.unmaximize()
  else w.maximize()
})
ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
