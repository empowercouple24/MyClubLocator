import * as esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'

// Read env vars that Vite would inject
const env = {
  'process.env.NODE_ENV': '"production"',
  'import.meta.env.VITE_SUPABASE_URL': `"${process.env.VITE_SUPABASE_URL || ''}"`,
  'import.meta.env.VITE_SUPABASE_ANON_KEY': `"${process.env.VITE_SUPABASE_ANON_KEY || ''}"`,
  'import.meta.env.VITE_BREVO_API_KEY': `"${process.env.VITE_BREVO_API_KEY || ''}"`,
  'import.meta.env.VITE_CENSUS_API_KEY': `"${process.env.VITE_CENSUS_API_KEY || ''}"`,
  'import.meta.env.MODE': '"production"',
  'import.meta.env.PROD': 'true',
  'import.meta.env.DEV': 'false',
  'import.meta.env.SSR': 'false',
}

const result = await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outdir: 'dist/assets',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunk-[hash]',
  entryNames: '[name]-[hash]',
  jsx: 'automatic',
  loader: { '.jsx': 'jsx', '.js': 'jsx', '.css': 'empty', '.svg': 'text', '.png': 'dataurl' },
  define: env,
  minify: true,
  target: 'es2020',
  metafile: true,
})

// Get output filenames
const outputs = Object.keys(result.metafile.outputs)
const mainJs = outputs.find(f => f.includes('main-') && f.endsWith('.js'))
const mainJsFile = path.basename(mainJs)

// Copy CSS (Vite processed it, we reuse)
if (!fs.existsSync('dist/assets')) fs.mkdirSync('dist/assets', { recursive: true })

// Find existing CSS from vite build
const cssFile = fs.readdirSync('dist/assets').find(f => f.endsWith('.css'))

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
      <div id="app-init-loader" style="position:fixed;inset:0;background:#f5f7f5;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#888;">Loading…</div>
    </div>
    <script type="module" src="/assets/${mainJsFile}"></script>
  </body>
</html>`

fs.writeFileSync('dist/index.html', html)
console.log('Build complete!')
console.log('Main JS:', mainJsFile)
