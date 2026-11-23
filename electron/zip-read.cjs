/**
 * 极简 zip 读取（零依赖）。
 *
 * 为什么不用 yauzl / adm-zip：语音包是分卷 zip，每卷 50 MB 左右，
 * 整个读进内存完全扛得住（解压完立刻释放），而引入一个生产依赖只为了读
 * 自己用 Python 打成 STORE 的包，性价比太低。
 *
 * 支持的压缩方式：0 (STORE) 与 8 (DEFLATE)。Python 的 zipfile 默认会写
 * 这两个，够用。ZIP64 刻意不支持——我们的卷远小于 4 GB、条目数远小于 65535，
 * 真遇到会明确报错而不是静默读错。
 */

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50

/** 从缓冲区里解析出所有条目：{ name, method, size, offset } */
function listEntries(buf) {
  /* EOCD 在文件尾，后面最多跟 65535 字节注释，从尾部往前扫 */
  const minPos = Math.max(0, buf.length - 22 - 0xffff)
  let p = buf.length - 22
  while (p >= minPos && buf.readUInt32LE(p) !== EOCD_SIG) p -= 1
  if (p < minPos) throw new Error('不是有效的 zip（找不到中央目录结尾标记）')

  const count = buf.readUInt16LE(p + 10)
  const cdOffset = buf.readUInt32LE(p + 16)
  if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('不支持 ZIP64 格式的语音包')

  const out = []
  let q = cdOffset
  for (let i = 0; i < count; i += 1) {
    if (q + 46 > buf.length || buf.readUInt32LE(q) !== CEN_SIG) {
      throw new Error(`中央目录第 ${i} 条损坏`)
    }
    const method = buf.readUInt16LE(q + 10)
    const csize = buf.readUInt32LE(q + 20)
    const nameLen = buf.readUInt16LE(q + 28)
    const extraLen = buf.readUInt16LE(q + 30)
    const commentLen = buf.readUInt16LE(q + 32)
    const localOffset = buf.readUInt32LE(q + 42)
    const name = buf.toString('utf8', q + 46, q + 46 + nameLen)
    /* 目录条目（以 / 结尾）没有数据，跳过 */
    if (!name.endsWith('/')) out.push({ name, method, csize, localOffset })
    q += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** 取单条目的原始数据（已解压） */
function readEntry(buf, entry) {
  const off = entry.localOffset
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== LOC_SIG) {
    throw new Error(`条目 ${entry.name} 的本地头损坏`)
  }
  const nameLen = buf.readUInt16LE(off + 26)
  const extraLen = buf.readUInt16LE(off + 28)
  const start = off + 30 + nameLen + extraLen
  const end = start + entry.csize
  if (end > buf.length) throw new Error(`条目 ${entry.name} 数据越界`)
  const raw = buf.subarray(start, end)
  if (entry.method === 0) return raw
  if (entry.method === 8) return zlib.inflateRawSync(raw)
  throw new Error(`条目 ${entry.name} 用了不支持的压缩方式 ${entry.method}`)
}

/**
 * 把 zip 解到 outDir。
 *
 * 语音包一个卷 3500 个小文件，Windows 上这块是安装耗时的大头（Defender
 * 还要逐个实时扫描）。三种写法实测（同一卷 3495 个文件）：
 *   每文件 mkdir + writeFileSync        约 40 s
 *   32 路 fs.promises.writeFile 并发     约 90 s ← 4 个线程池线程被抢爆
 *   顺序同步写 + 每 120 个让出事件循环   约 40 s，且界面不假死
 * 取最后一种：单线程顺序写没有排队开销，定时 yield 让主进程还能回 IPC。
 *
 * @param {(done: number, total: number) => void} [onProgress] 每让出一次报一次
 * @returns {Promise<{ files: number, skipped: string[] }>} 写出的文件数与跳过的可疑条目
 */
async function extractZipTo(buf, outDir, onlyPrefix = '', onProgress) {
  const entries = listEntries(buf)
  const skipped = []
  const root = path.resolve(outDir)
  const madeDirs = new Set()
  const todo = entries.filter((e) => !onlyPrefix || e.name.startsWith(onlyPrefix))
  const total = todo.length
  let files = 0

  for (const e of todo) {
    /* 路径穿越防护：解压包来自网络，绝不能让 ../ 跳出去写文件 */
    const dest = path.resolve(root, e.name)
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      skipped.push(e.name)
      continue
    }
    const dir = path.dirname(dest)
    if (!madeDirs.has(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      madeDirs.add(dir)
    }
    fs.writeFileSync(dest, readEntry(buf, e))
    files += 1
    if (files % 120 === 0) {
      if (onProgress) onProgress(files, total)
      await new Promise((r) => setImmediate(r))
    }
  }
  if (onProgress) onProgress(files, total)
  return { files, skipped }
}

module.exports = { listEntries, extractZipTo }
