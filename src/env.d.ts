export interface WindowApi {
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => void
  setTheme: (t: string) => void
  /** 注册「系统侧要求关闭」的回调，返回注销函数 */
  onAskClose: (cb: () => void) => () => void
  /** 确认退出 */
  closeConfirmed: () => void
  /** 少儿守护：开启后窗口全屏，并屏蔽刷新/开发者工具快捷键 */
  setGuardMode?: (on: boolean) => void
  /** 读一段离线语音 mp3（按 hash），越权或缺失返回 null */
  readVoice?: (hash: string) => Promise<Uint8Array | null>
}

declare global {
  interface Window {
    spellpal?: WindowApi
  }
  /** 构建时由 vite define 注入，取自 package.json 的 version */
  const __APP_VERSION__: string
}

export {}
