export interface WindowApi {
  minimize: () => void
  maximize: () => void
  close: () => void
}

declare global {
  interface Window {
    spellpal?: WindowApi
  }
}

export {}
