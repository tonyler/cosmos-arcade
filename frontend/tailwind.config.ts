import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        px:   ['"Press Start 2P"', 'monospace'],
        mono: ['"Space Mono"', 'monospace'],
        ui:   ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        c: {
          bg:       '#141e30',
          panel:    '#0e1623',
          surface:  '#18233a',
          surface2: '#1e2d47',
          border:   '#223050',
          borderhi: '#334565',
        },
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%,100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':     { transform: 'translateY(-14px) rotate(1.5deg)' },
          '66%':     { transform: 'translateY(6px) rotate(-1deg)' },
        },
        pulse2: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.4' },
        },
      },
      animation: {
        'fade-up':   'fadeUp 0.45s ease both',
        'drift-a':   'drift 9s ease-in-out infinite',
        'drift-b':   'drift 13s ease-in-out infinite 2s',
        'drift-c':   'drift 11s ease-in-out infinite 5s',
        'pulse2':    'pulse2 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
