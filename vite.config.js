import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase') || id.includes('supabase')) return 'supabase'
          if (id.includes('react-dom') || id.includes('node_modules/react/')) return 'react'
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router'
          if (id.includes('react-leaflet') || id.includes('@react-leaflet') || id.includes('leaflet')) return 'leaflet'
        },
      },
    },
  },
})
