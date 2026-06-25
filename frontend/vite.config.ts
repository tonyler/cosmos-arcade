import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  base: '/hackathon/',
  envDir: '..',
  css: {
    postcss: {
      plugins: [
        tailwind('./tailwind.config.ts'),
        autoprefixer(),
      ],
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
})
