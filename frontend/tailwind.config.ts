import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        px:   ['"Russo One"', 'sans-serif'],      // headings / logo
        mono: ['"Space Mono"', 'monospace'],       // code / data
        ui:   ['Sora', 'sans-serif'],              // body / UI
      },
      colors: {
        c: {
          bg:       '#04040d',                     // near-void
          panel:    '#08081a',                     // side panels
          surface:  '#0e0e22',                     // card surfaces
          surface2: '#14142c',                     // elevated surfaces
          border:   'rgba(109,40,217,0.18)',       // subtle violet dividers
          borderhi: 'rgba(139,92,246,0.40)',       // hover / active borders
        },
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%,100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%':     { transform: 'translateY(-18px) translateX(6px)' },
          '66%':     { transform: 'translateY(8px) translateX(-4px)' },
        },
        pulse2: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.5' },
        },
        blink: {
          '0%,49%':   { opacity: '1' },
          '50%,100%': { opacity: '0' },
        },
        glowPulse: {
          '0%,100%': { opacity: '0.12' },
          '50%':     { opacity: '0.22' },
        },
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease both',
        'drift-a':    'drift 12s ease-in-out infinite',
        'drift-b':    'drift 16s ease-in-out infinite 3s',
        'drift-c':    'drift 20s ease-in-out infinite 7s',
        'pulse2':     'pulse2 3s ease-in-out infinite',
        'blink':      'blink 1s step-end infinite',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
