import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // When called for CSS-only pass, we only want CSS output
    // Full JS build is handled by esbuild (build.mjs)
    rollupOptions: {
      output: {
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  },
})
