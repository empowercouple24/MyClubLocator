import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'leaflet': path.resolve('./src/lib/leaflet-shim.js'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react'
          }
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run')) {
            return 'router'
          }
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/supabase')) {
            return 'supabase'
          }
          if (id.includes('node_modules/react-leaflet') || id.includes('node_modules/@react-leaflet')) {
            return 'react-leaflet'
          }
        },
      },
    },
  },
})
