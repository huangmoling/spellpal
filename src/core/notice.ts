/**
 * 关于 / 版权声明。
 *
 * 文案刻意不写成明文常量：字符串在构建产物里是可搜索的，直接写
 * `'https://github.com/...'` 或者「严禁倒卖」，被人 grep 一下就能整段替换掉。
 * 这里把 UTF-8 字节做一次位置相关的异或再 base64，运行期拼回来。
 *
 * 说明：这不是加密，只是「不显眼」。前端代码总要被执行，谁都能在 DevTools 里
 * 看到最终字符串；真正的防篡改只能靠服务端校验或代码签名，单机软件做不到。
 */

const K = [0x5b, 0x27, 0x91, 0x44, 0xe3, 0x1a, 0x7c, 0xb2]

const _d = (b64: string): string => {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i) ^ K[i % K.length] ^ ((i * 31) & 0xff)
  }
  return new TextDecoder().decode(out)
}

const A =
  'vogg/xQ9IOIoEPRh8uWiM8pEn+8XPjP+PsgDuGIlXpUBSGfEEIVdvWxsC5UPzAmlCi0f+0r8YPgTQg=='
const B =
  'v4Uz8R8EItMu2TqxcidNix6yVps+clb5VoY15xkFOs4bMAXIVvNX7zpgYvkHjVSFY3cGjRfbHqY8JCzXSMVy9hZui+R/ppyvB0rdt0Dr6JFKDfDLK+mY3k9gks5WtqK/HyHQX02Aw3VUdc8BEaemJVYLvSl707ZPNS30Rm6x2GNjUJAF+ZnpDqY9zyWu7tRnyCi9'
const C =
  'vYI//j8AItAGEOpYw6kr7iTAEadqFHqeD6BYvQt/ctFTZwGROMsDhBUzB/BT1kDlH3F86S6XeYt1RBiJAPgRrwAc0t837rHPXG2AxE6ts78DaPqucuPzq34Py80j4ZPbXRmpM3XEo0YrJP5Wba3Ke1dg+hYKvbMzcAWxKXfcq1U+K656n4M='
const U = 'M0zbaey76UTEWdN54uvgAMRFkGH68Lgc3k/baOn+8QDLveMVzwCK'

/** 三句话：①免费开源、严禁倒卖 ②花钱买到就是被骗 ③MIT 公开但请保留署名 */
export const noticeLines = (): string[] => [_d(A), _d(B), _d(C)]

export const repoUrl = (): string => _d(U)

/** 在系统浏览器里打开仓库；Electron 下走主进程白名单，浏览器里退化为新标签页 */
export const openRepo = () => {
  const url = repoUrl()
  const api = (window as unknown as { spellpal?: { openExternal?: (u: string) => void } }).spellpal
  if (api?.openExternal) api.openExternal(url)
  else window.open(url, '_blank', 'noopener')
}
