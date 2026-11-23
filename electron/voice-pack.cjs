/**
 * 离线语音包管理器（主进程侧）。
 *
 * 安装包里不再塞 134 MB 的 mp3，改成「软件本体 + 首次启动按需下载」：
 *   - 分卷 zip 放在 GitHub Release，`voice-pack.manifest.json` 里写清每卷的大小与 SHA256
 *   - 下载到 userData/voice-tmp，逐卷校验通过后解到 userData/voice-new，
 *     全部就位再原子换名成 userData/voice，中途失败不会把能用的旧包弄坏
 *   - 支持 Range 续传：网断了重开，已下的字节不用重下
 *
 * 读完的文件路径由 voice-io.cjs 优先取 userData/voice，取不到再回退包内 dist/voice，
 * 所以老版本留下的包、开发模式下 public/voice 都能继续用。
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { net } = require('electron')
const { extractZipTo } = require('./zip-read.cjs')

const STATE_FILE = 'voice-pack-state.json'
/** 下载失败后同一卷最多重试几次（每轮都是纯续传，代价很小） */
const PART_RETRIES = 3
/** 进度事件的最小间隔，避免 9374 个文件把 IPC 打爆 */
const PROGRESS_MS = 250

/** @type {any} */
let MANIFEST = null
/** 当前进行中的任务，防止用户连点两次「下载」并发跑两份 */
let running = null

function loadManifest(file) {
  if (MANIFEST) return MANIFEST
  try {
    MANIFEST = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    MANIFEST = { version: '', count: 0, bytes: 0, parts: [], baseUrl: '' }
  }
  return MANIFEST
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    const s = fs.createReadStream(file)
    s.on('data', (c) => h.update(c))
    s.on('end', () => resolve(h.digest('hex')))
    s.on('error', reject)
  })
}

function human(n) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

function createVoicePack({ app, ipcMain, distDir, manifestFile, getWindow }) {
  const manifest = loadManifest(manifestFile)
  const voiceDir = path.join(app.getPath('userData'), 'voice')
  const tmpDir = path.join(app.getPath('userData'), 'voice-tmp')
  const newDir = path.join(app.getPath('userData'), 'voice-new')
  const stateFile = path.join(app.getPath('userData'), STATE_FILE)

  const readState = () => {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    } catch {
      return {}
    }
  }
  const writeState = (patch) => {
    const next = { ...readState(), ...patch }
    try {
      fs.writeFileSync(stateFile, JSON.stringify(next, null, 2))
    } catch {
      /* userData 写不进去也只能算了，下次重新检查 */
    }
    return next
  }

  const countMp3 = (dir) => {
    try {
      /* 音频是平铺的，不用递归；平铺也顺便挡住了异常目录结构 */
      return fs.readdirSync(dir).filter((n) => n.endsWith('.mp3')).length
    } catch {
      return 0
    }
  }

  /** 包内自带的那份（老版本 / 开发模式），用来判断「其实已经能发音了」 */
  const bundledCount = () => countMp3(path.join(distDir, 'voice'))
  const installedCount = () => countMp3(voiceDir)

  function status() {
    const st = readState()
    const count = installedCount()
    const bundled = bundledCount()
    const want = Number(manifest.count) || 0
    /* 「能用」有三个来源：外置包已装好、包内自带、用户主动选了稍后再下 */
    const usable = count > 0 || bundled > 0 || st.skipped === true
    return {
      installed: count > 0,
      usable,
      skipped: st.skipped === true,
      count,
      bundled,
      expectedCount: want,
      version: st.version || '',
      expectedVersion: manifest.version || '',
      bytes: (manifest.parts || []).reduce((s, p) => s + Number(p.zipBytes || p.bytes || 0), 0),
      parts: (manifest.parts || []).map((p) => ({ name: p.name, bytes: p.bytes })),
      /* 已装版本比内置清单旧 → 有更新可下 */
      outdated: count > 0 && Boolean(manifest.version) && st.version !== manifest.version,
      missing: Boolean(manifest.version) && count > 0 && want > 0 && count < want,
      voiceDir,
      mirrored: st.mirror || '',
      presetMirror: manifest.baseUrl || '',
    }
  }

  function baseUrlOf(mirror) {
    const tpl = String(mirror || manifest.baseUrl || '').trim()
    if (!tpl) return ''
    return tpl.replace(/\{version\}/g, encodeURIComponent(manifest.version || '')).replace(/\/+$/, '')
  }

  function emit(payload) {
    try {
      const w = getWindow()
      if (w && !w.isDestroyed()) w.webContents.send('voicepack:progress', payload)
    } catch {
      /* 窗口已经关了，进度没人收也无所谓 */
    }
  }

  /**
   * 单卷下载（带续传）。
   * 返回实际写入的字节数；网络异常抛出去由上层重试。
   */
  function fetchPart(url, dest, expectBytes, onBytes) {
    return new Promise((resolve, reject) => {
      let have = 0
      try {
        have = fs.statSync(dest).size
      } catch {
        have = 0
      }
      if (have > expectBytes) {
        /* 上一轮写到一半被杀、长度反而超了，只能重下 */
        try {
          fs.rmSync(dest, { force: true })
        } catch {}
        have = 0
      }
      if (have === expectBytes) return resolve(have)

      const req = net.request({ url, method: 'GET', redirect: 'follow' })
      if (have > 0) req.setHeader('Range', `bytes=${have}-`)
      req.setHeader('User-Agent', `SpellPal/${app.getVersion()}`)

      let settled = false
      const fail = (e) => {
        if (settled) return
        settled = true
        try {
          req.abort()
        } catch {}
        reject(e instanceof Error ? e : new Error(String(e)))
      }

      req.on('response', (res) => {
        const code = res.statusCode
        /* 206 = 续传成功；200 = 服务端不认 Range，从头来；
           416 = 我们的 .part 比服务端还长，删了等下一轮重下 */
        if (code === 416) {
          try {
            fs.rmSync(dest, { force: true })
          } catch {}
          return fail(new Error('续传位置无效，已重置'))
        }
        if (code !== 200 && code !== 206) {
          return fail(new Error(`下载失败：HTTP ${code}（${url}）`))
        }
        const append = code === 206 && have > 0
        const ws = fs.createWriteStream(dest, { flags: append ? 'a' : 'w' })
        let got = append ? have : 0
        res.on('data', (chunk) => {
          got += chunk.length
          onBytes(got)
        })
        res.pipe(ws)
        ws.on('finish', () => {
          if (settled) return
          settled = true
          if (got !== expectBytes) {
            return reject(new Error(`大小不符：期望 ${expectBytes} 实际 ${got}`))
          }
          resolve(got)
        })
        ws.on('error', fail)
        res.on('error', fail)
      })
      req.on('error', fail)
      req.end()
    })
  }

  /**
   * 静默测速：对某个源发一个 64 KB 的 Range 探测，返回「首字节到达」的毫秒数。
   * 不通 / 超时 / 404 一律返回 Infinity，排序时自然沉到最后。
   * 全程不发进度事件，用户看不到，只是下载快一点。
   */
  function probeMirror(url, timeoutMs) {
    return new Promise((resolve) => {
      const started = Date.now()
      let settled = false
      const done = (ms) => {
        if (settled) return
        settled = true
        resolve(ms)
      }
      const timer = setTimeout(() => done(Infinity), timeoutMs)
      try {
        const req = net.request({ url, method: 'GET', redirect: 'follow' })
        req.setHeader('Range', 'bytes=0-65535')
        req.setHeader('Cache-Control', 'no-cache')
        req.on('response', (res) => {
          const code = res.statusCode || 0
          if (code >= 200 && code < 400) {
            res.once('data', () => {
              clearTimeout(timer)
              done(Date.now() - started)
              try {
                req.abort()
              } catch {}
            })
            res.once('end', () => {
              clearTimeout(timer)
              done(Date.now() - started)
            })
          } else {
            clearTimeout(timer)
            done(Infinity)
          }
        })
        req.on('error', () => {
          clearTimeout(timer)
          done(Infinity)
        })
        req.end()
      } catch {
        clearTimeout(timer)
        done(Infinity)
      }
    })
  }

  /**
   * 自动优选：所有候选源并发探一次，按首字节耗时升序排。
   * 探不通的排最后（还会当兜底试一次），保证「哪个节点快用哪个」。
   */
  async function rankMirrors(mirrors, sampleName) {
    const sample = sampleName ? `/${encodeURIComponent(sampleName)}` : ''
    const probed = await Promise.all(
      mirrors.map(async (base, i) => ({ base, i, ms: await probeMirror(base + sample, 4000) })),
    )
    probed.sort((a, b) => (a.ms === b.ms ? a.i - b.i : a.ms - b.ms))
    return probed.map((p) => p.base)
  }

  /** 从若干候选地址里挑一个能用的（下载到第一块数据就算通） */
  async function downloadAll(opts) {
    const mirrors = []
    const custom = baseUrlOf(opts.mirror)
    if (custom) mirrors.push(custom)
    for (const m of manifest.mirrors || []) {
      if (m && !mirrors.includes(m)) mirrors.push(m)
    }
    if (!mirrors.length) throw new Error('语音包清单里没有配置下载地址')

    const parts = manifest.parts || []
    if (!parts.length) throw new Error('语音包清单是空的，请先重新打包')

    /* 用户手动指定了源就不测速了，直接按他给的顺序走 */
    const ordered = opts.mirror ? mirrors : await rankMirrors(mirrors, parts[0].name)

    fs.mkdirSync(tmpDir, { recursive: true })
    /* 一卷的真实字节数 = zip 文件大小。清单里的 bytes 是卷内 mp3 之和，
       两者差一个 zip 目录的开销（134 MB 的包差约 800 KB），拿错了永远校验不过。 */
    const sizeOf = (part) => Number(part.zipBytes || part.bytes || 0)

    /** 第 i 卷之前已经完整落盘的字节数（续传重启时用来把进度条接上） */
    const bytesDone = (i) => {
      let sum = 0
      for (let k = 0; k < i; k += 1) {
        try {
          if (fs.statSync(path.join(tmpDir, parts[k].name)).size === sizeOf(parts[k])) {
            sum += sizeOf(parts[k])
          }
        } catch {
          /* 卷还没下 */
        }
      }
      return sum
    }

    const totalBytes = parts.reduce((s, p) => s + sizeOf(p), 0)
    let doneBytes = bytesDone(parts.length)
    let lastEmit = 0
    let lastAt = Date.now()
    let lastBytes = doneBytes
    const speedWindow = []

    const pushProgress = (partIndex, force) => {
      const now = Date.now()
      if (!force && now - lastEmit < PROGRESS_MS) return
      lastEmit = now
      const dt = (now - lastAt) / 1000
      if (dt >= 0.2) {
        const delta = Math.max(0, doneBytes - lastBytes)
        speedWindow.push(delta / dt)
        if (speedWindow.length > 8) speedWindow.shift()
        lastAt = now
        lastBytes = doneBytes
      }
      const speed = speedWindow.length ? speedWindow.reduce((a, b) => a + b, 0) / speedWindow.length : 0
      emit({
        phase: 'download',
        partIndex,
        partCount: parts.length,
        partName: parts[partIndex - 1] ? parts[partIndex - 1].name : '',
        got: doneBytes,
        total: totalBytes,
        speed,
        eta: speed > 1024 ? Math.round((totalBytes - doneBytes) / speed) : -1,
      })
    }

    pushProgress(1, true)

    let mirrorUsed = ''
    let lastError = null
    for (const base of ordered) {
      try {
        for (let i = 0; i < parts.length; i += 1) {
          const part = parts[i]
          const dest = path.join(tmpDir, part.name)
          const url = `${base}/${encodeURIComponent(part.name)}`
          /* 本卷起点：前面若干完整卷的字节和 */
          const base0 = bytesDone(i)
          doneBytes = base0
          let ok = false
          for (let attempt = 0; attempt < PART_RETRIES && !ok; attempt += 1) {
            try {
              await fetchPart(url, dest, sizeOf(part), (got) => {
                doneBytes = base0 + got
                pushProgress(i + 1)
              })
              ok = true
            } catch (e) {
              lastError = e
              /* 换源比原地重试更可能成功，这里只做几次快速重试兜住瞬时抖动 */
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
            }
          }
          if (!ok) throw lastError || new Error(`第 ${i + 1} 卷下载失败`)

          /* 卷级校验：损坏的包绝不能解出来再用，删掉让下一轮重下 */
          emit({ phase: 'verify', partIndex: i + 1, partCount: parts.length, partName: part.name })
          const digest = await sha256File(dest)
          if (part.sha256 && digest !== part.sha256) {
            try {
              fs.rmSync(dest, { force: true })
            } catch {}
            throw new Error(`第 ${i + 1} 卷校验失败，已删除重下`)
          }
          doneBytes = bytesDone(i + 1)
          pushProgress(i + 1, true)
        }
        mirrorUsed = base
        break
      } catch (e) {
        lastError = e
        /* 这个源不行；已下完整的卷留着，换源接着续传 */
        if (base === ordered[ordered.length - 1]) throw e
        let host = base
        try {
          host = new URL(base).host
        } catch {}
        emit({ phase: 'switch', message: `${host} 不通，换下一个下载源` })
      }
    }

    writeState({ mirror: mirrorUsed })
    return { mirrorUsed, totalBytes }
  }

  /** 把 tmp 里的卷解到 voice-new，再原子换掉旧目录 */
  async function installFromParts() {
    const parts = manifest.parts || []
    fs.rmSync(newDir, { recursive: true, force: true })
    fs.mkdirSync(newDir, { recursive: true })

    let written = 0
    for (let i = 0; i < parts.length; i += 1) {
      const dest = path.join(tmpDir, parts[i].name)
      emit({ phase: 'extract', partIndex: i + 1, partCount: parts.length, partName: parts[i].name })
      const buf = await fs.promises.readFile(dest)
      const r = await extractZipTo(buf, newDir, 'voice/', (done, total) => {
        /* 解压阶段 got/total 是「文件数」，前端按阶段换文案 */
        emit({
          phase: 'extract',
          partIndex: i + 1,
          partCount: parts.length,
          partName: parts[i].name,
          got: done,
          total,
        })
      })
      written += r.files
    }

    const got = countMp3(path.join(newDir, 'voice'))
    const want = Number(manifest.count) || 0
    if (want > 0 && got < want) {
      throw new Error(`解压后只有 ${got} 段音频，清单要求 ${want} 段`)
    }

    emit({ phase: 'install', message: `安装 ${got} 段音频` })
    fs.rmSync(voiceDir, { recursive: true, force: true })
    fs.renameSync(path.join(newDir, 'voice'), voiceDir)
    fs.rmSync(newDir, { recursive: true, force: true })
    /* 装好了就把分卷删掉，50 MB × 3 没必要一直占着磁盘 */
    fs.rmSync(tmpDir, { recursive: true, force: true })

    writeState({
      version: manifest.version || '',
      count: got,
      bytes: (manifest.parts || []).reduce((s, p) => s + Number(p.zipBytes || p.bytes || 0), 0),
      installedAt: new Date().toISOString(),
      skipped: false,
    })
    return got
  }

  /** 对外：开始下载安装。同一时间只允许一个任务。 */
  async function download(opts = {}) {
    if (running) return running
    running = (async () => {
      try {
        emit({ phase: 'start', total: (manifest.parts || []).reduce((s, p) => s + Number(p.zipBytes || p.bytes || 0), 0) })
        const info = await downloadAll(opts)
        const count = await installFromParts()
        emit({ phase: 'done', count, bytes: info.totalBytes, mirror: info.mirrorUsed })
        return { ok: true, count }
      } catch (e) {
        const message = e && e.message ? e.message : String(e)
        emit({ phase: 'error', message })
        return { ok: false, message }
      } finally {
        running = null
      }
    })()
    return running
  }

  /**
   * 从本地 zip 导入——学校机房、内网、下载源全挂时的兜底。
   * 允许一次传多卷：多选或依次拖入都行，按清单里的文件名匹配。
   */
  async function installFromFiles(files) {
    if (running) return running
    running = (async () => {
      try {
        const list = Array.isArray(files) ? files.filter(Boolean) : []
        if (!list.length) throw new Error('没有选择文件')

        /* 单文件导入：用户可能下的是整包（不切卷）或只有一卷，直接解就行，
           不必强求跟清单对上——能解出音频就装。 */
        fs.rmSync(newDir, { recursive: true, force: true })
        fs.mkdirSync(newDir, { recursive: true })
        fs.mkdirSync(tmpDir, { recursive: true })

        let written = 0
        for (let i = 0; i < list.length; i += 1) {
          emit({ phase: 'extract', partIndex: i + 1, partCount: list.length, partName: path.basename(list[i]) })
          /* 大卷用流式读不划算（要随机访问中央目录），直接整读，50 MB 一次 */
          const buf = await fs.promises.readFile(list[i])
          written += (await extractZipTo(buf, newDir, '')).files
        }

        /* 容忍包内多套一层目录：找 mp3 最多且成规模的那一层 */
        let srcDir = path.join(newDir, 'voice')
        if (!fs.existsSync(srcDir)) {
          const found = findVoiceDir(newDir, 0)
          if (!found) throw new Error('这个包里没有找到 mp3 音频')
          srcDir = found
        }
        const got = countMp3(srcDir)
        if (got === 0) throw new Error('这个包里没有找到 mp3 音频')

        emit({ phase: 'install', message: `安装 ${got} 段音频` })
        fs.rmSync(voiceDir, { recursive: true, force: true })
        fs.renameSync(srcDir, voiceDir)
        fs.rmSync(newDir, { recursive: true, force: true })
        fs.rmSync(tmpDir, { recursive: true, force: true })

        writeState({
          version: manifest.version || '',
          count: got,
          installedAt: new Date().toISOString(),
          source: 'file',
          skipped: false,
        })
        emit({ phase: 'done', count: got })
        return { ok: true, count: got }
      } catch (e) {
        const message = e && e.message ? e.message : String(e)
        emit({ phase: 'error', message })
        return { ok: false, message }
      } finally {
        running = null
      }
    })()
    return running
  }

  /** 深度有限地找「装着 mp3 的目录」 */
  function findVoiceDir(dir, depth) {
    if (depth > 2) return ''
    let best = ''
    let bestN = 0
    let names = []
    try {
      names = fs.readdirSync(dir)
    } catch {
      return ''
    }
    for (const n of names) {
      const p = path.join(dir, n)
      let st
      try {
        st = fs.statSync(p)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      const c = countMp3(p)
      if (c > bestN) {
        bestN = c
        best = p
      }
      const deeper = findVoiceDir(p, depth + 1)
      if (deeper) {
        const dc = countMp3(deeper)
        if (dc > bestN) {
          bestN = dc
          best = deeper
        }
      }
    }
    return bestN >= 10 ? best : ''
  }

  /** 用户在引导页选了「先不下载」 */
  function skip(on) {
    writeState({ skipped: on !== false })
    return status()
  }

  /** 彻底卸载外置包，回到包内自带的（或系统语音） */
  function remove() {
    fs.rmSync(voiceDir, { recursive: true, force: true })
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.rmSync(newDir, { recursive: true, force: true })
    writeState({ version: '', count: 0, skipped: true })
    return status()
  }

  /* ---------------- IPC ---------------- */

  ipcMain.handle('voicepack:status', () => ({ ...status(), manifest: { version: manifest.version, count: manifest.count } }))
  ipcMain.handle('voicepack:download', (_e, opts) => download(opts || {}))
  ipcMain.handle('voicepack:skip', (_e, on) => skip(on))
  ipcMain.handle('voicepack:remove', () => remove())
  ipcMain.handle('voicepack:pick-and-install', async () => {
    const { dialog } = require('electron')
    const w = getWindow()
    const r = await dialog.showOpenDialog(w || undefined, {
      title: '选择语音包（可多选分卷）',
      filters: [{ name: '语音包', extensions: ['zip'] }],
      properties: ['openFile', 'multiSelections'],
    })
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true }
    return installFromFiles(r.filePaths)
  })

  return { status, download, skip, remove, installFromFiles, voiceDir, bundledCount }
}

module.exports = { createVoicePack, human }
