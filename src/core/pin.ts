/**
 * 少儿守护用的 6 位数字密码。
 *
 * 只是防止孩子自己关掉软件，不是加密存储，所以用一条加盐散列就够了：
 * 存明文的话，孩子打开开发者工具一眼就能看到密码。
 * 密码不可逆推 → 家长忘记密码时，按「关于」页的说明清掉应用数据重设。
 */

const SALT = 'spellpal:guard:v1'

/** djb2 + 乘 33 异或，纯 JS 实现，避免引入依赖 */
export const hashPin = (pin: string) => {
  let h = 5381
  const s = `${SALT}|${pin}|${SALT}`
  for (let i = 0; i < s.length; i += 1) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  }
  /* 再滚一轮，让哈希值散得更匀 */
  let g = 2166136261
  for (let i = s.length - 1; i >= 0; i -= 1) {
    g = ((g ^ s.charCodeAt(i)) * 16777619) >>> 0
  }
  return `g1:${h.toString(36)}${g.toString(36)}`
}

/** 只接受 6 位阿拉伯数字 */
export const isPin = (s: string) => /^\d{6}$/.test(s)

/** 秒 → 「12 分钟」「1 小时 5 分钟」 */
export const fmtDuration = (sec: number) => {
  const m = Math.floor(Math.max(0, sec) / 60)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分钟` : `${h} 小时`
}

/** 本地日期串，用于「今日已学」的跨天判断 */
export const todayStr = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
