import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['leaflet', 'react-leaflet'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep leaflet as its own chunk to prevent internal const reordering
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})
