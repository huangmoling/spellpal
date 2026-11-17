/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stage: '#0B0E13',
        card: '#161C26',
        panel: '#1F2733',
        ink: '#F2F5F9',
        muted: '#8B94A6',
        brand: '#7C5CFF',
        ok: '#34D399',
        err: '#F87171',
        cursor: '#FBBF24',
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
      },
      animation: {
        shake: 'shake 0.28s ease-in-out',
        pop: 'pop 0.18s ease-out',
        rise: 'rise 0.28s ease-out',
      },
    },
  },
  plugins: [],
}
