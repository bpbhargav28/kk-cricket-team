import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project from https://<user>.github.io/<repo>/
// so every asset URL has to be prefixed with the repository name.
// Override with VITE_BASE_PATH=/ when hosting at a domain root (Netlify, Vercel, custom domain).
const base = process.env.VITE_BASE_PATH ?? '/kk-cricket-team/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
})
