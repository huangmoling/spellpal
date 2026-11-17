export interface WindowApi {
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => void
  setTheme: (t: string) => void
}

declare global {
  interface Window {
    spellpal?: WindowApi
  }
  /** 构建时由 vite define 注入，取自 package.json 的 version */
  const __APP_VERSION__: string
}

export {}
