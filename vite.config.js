import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'leaflet': path.resolve(__dirname, 'src/lib/leaflet-esm.js'),
    },
  },
  optimizeDeps: {
    // Force esbuild (not Rollup) to pre-bundle these — esbuild handles
    // module merging correctly without creating TDZ errors
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@supabase/supabase-js',
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react-dom') || (id.includes('node_modules/react/') && !id.includes('react-router'))) return 'react'
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router'
          if (id.includes('react-leaflet') || id.includes('@react-leaflet')) return 'react-leaflet'
        },
      },
    },
  },
})
