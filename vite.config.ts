import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 4321,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@hugeicons')) return 'icons'
            if (id.includes('recharts') || id.includes('d3')) return 'charts'
            if (id.includes('@tanstack')) return 'tanstack'
            return 'vendor'
          }
        },
      },
    },
  },
})
