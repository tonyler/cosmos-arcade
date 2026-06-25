import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  base: '/hackathon2/',
  envDir: '..',
  css: {
    postcss: {
      plugins: [
        tailwind('./tailwind.config.hackathon2.ts'),
        autoprefixer(),
      ],
    },
  },
  build: {
    outDir: 'dist2',
    rollupOptions: {
      input: 'index.hackathon2.html',
    },
  },
})
