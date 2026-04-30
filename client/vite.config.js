import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5500',
      '/stream': 'http://localhost:5500',
    }
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  }
})
