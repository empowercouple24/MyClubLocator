// Production build using esbuild — avoids Rollup's TDZ const-reordering bug
import * as esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'

const outdir = 'dist/assets'
if (!fs.existsSync('dist')) fs.mkdirSync('dist')
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true })

// Map Vite-style env vars to esbuild defines
// esbuild replaces these at build time using actual process.env values
const define = {
  'process.env.NODE_ENV': JSON.stringify('production'),
  'import.meta.env.MODE': JSON.stringify('production'),
  'import.meta.env.PROD': 'true',
  'import.meta.env.DEV': 'false',
  'import.meta.env.SSR': 'false',
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
  'import.meta.env.VITE_BREVO_API_KEY': JSON.stringify(process.env.VITE_BREVO_API_KEY || ''),
  'import.meta.env.VITE_CENSUS_API_KEY': JSON.stringify(process.env.VITE_CENSUS_API_KEY || ''),
}

console.log('Building JS with esbuild...')
console.log('SUPABASE_URL set:', !!process.env.VITE_SUPABASE_URL)

// Build JS
const jsResult = await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outdir,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunk-[hash]',
  entryNames: 'main-[hash]',
  jsx: 'automatic',
  loader: {
    '.jsx': 'jsx',
    '.js': 'jsx',
    '.css': 'empty',
    '.svg': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.gif': 'dataurl',
  },
  define,
  minify: true,
  target: 'es2020',
  metafile: true,
  logLevel: 'info',
})

// Build CSS separately
console.log('Building CSS with esbuild...')
await esbuild.build({
  entryPoints: ['src/index.css'],
  bundle: true,
  outdir,
  entryNames: 'index-[hash]',
  minify: true,
  logLevel: 'info',
})

// Find output files
const mainJs = Object.keys(jsResult.metafile.outputs)
  .find(f => f.includes('/main-') && f.endsWith('.js'))
const mainJsFile = path.basename(mainJs)
const cssFile = fs.readdirSync(outdir).find(f => f.endsWith('.css')) || ''

// Write index.html
const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Club Locator</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    ${cssFile ? `<link rel="stylesheet" crossorigin href="/assets/${cssFile}">` : ''}
  </head>
  <body>
    <div id="root">
      <div id="app-init-loader" style="position:fixed;inset:0;background:#f5f7f5;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#888;">Loading\u2026</div>
    </div>
    <script type="module" src="/assets/${mainJsFile}"></script>
  </body>
</html>`

fs.writeFileSync('dist/index.html', html)
console.log('Build complete!')
console.log('  JS entry:', mainJsFile)
console.log('  CSS:', cssFile)
