import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Force leaflet to use its ESM build (all `var`, no TDZ issues)
      // instead of the UMD/CJS build that Rollup mangles
      'leaflet': path.resolve(__dirname, 'src/lib/leaflet-esm.js'),
    },
  },
})
