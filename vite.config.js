import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-map'
            if (id.includes('@supabase') || id.includes('supabase')) return 'vendor-supabase'
            return 'vendor'
          }
        },
      },
    },
  },
})
