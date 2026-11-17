/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stage: 'rgb(var(--stage) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        /** 叠加层基色：暗色主题是白，浅色主题是黑，别直接用 white/x */
        veil: 'rgb(var(--veil) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        err: 'rgb(var(--err) / <alpha-value>)',
        cursor: 'rgb(var(--cursor) / <alpha-value>)',
      },
      fontFamily: {
        ui: ['Inter', 'system-ui', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-5px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        rise: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        celebrate: {
          '0%': { transform: 'scale(0.82) translateY(10px)', opacity: '0' },
          '62%': { transform: 'scale(1.045) translateY(0)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
      },
      animation: {
        shake: 'shake 0.28s ease-in-out',
        pop: 'pop 0.18s ease-out',
        rise: 'rise 0.28s ease-out',
        celebrate: 'celebrate 0.42s cubic-bezier(0.22, 0.9, 0.3, 1.2) both',
      },
    },
  },
  plugins: [],
}
