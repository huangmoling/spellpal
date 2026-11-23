import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import pkg from './package.json'

export default defineConfig(({ command }) => ({
  // Electron 用 file:// 加载，必须用相对路径
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  /* public/ 下只有语音包（134 MB / 9374 个 mp3）。开发时照常 serve，
     构建时整个目录都不拷——音频改成首次启动从远端下载，塞进 asar 会让
     安装包凭空多 130 MB（mp3 本来就压缩过，NSIS 再压也压不动）。 */
  publicDir: command === 'serve' ? 'public' : false,
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
}))
