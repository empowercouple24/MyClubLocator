import * as esbuild from 'esbuild'
import fs from 'fs'

const outdir = 'dist/assets'
if (!fs.existsSync('dist')) fs.mkdirSync('dist')
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true })

// Point import.meta.env reads to window.__env (injected in index.html)
// This keeps the bundle identical across environments — no TDZ from env var substitution
const define = {
  'process.env.NODE_ENV': JSON.stringify('production'),
  'import.meta.env.MODE': JSON.stringify('production'),
  'import.meta.env.PROD': 'true',
  'import.meta.env.DEV': 'false',
  'import.meta.env.SSR': 'false',
  'import.meta.env.VITE_SUPABASE_URL': 'window.__env.VITE_SUPABASE_URL',
  'import.meta.env.VITE_SUPABASE_ANON_KEY': 'window.__env.VITE_SUPABASE_ANON_KEY',
  'import.meta.env.VITE_BREVO_API_KEY': 'window.__env.VITE_BREVO_API_KEY',
  'import.meta.env.VITE_CENSUS_API_KEY': 'window.__env.VITE_CENSUS_API_KEY',
  'import.meta.env.VITE_MAPBOX_TOKEN': 'window.__env.VITE_MAPBOX_TOKEN',
}

console.log('Building JS with esbuild...')
await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outfile: `${outdir}/main-bundle.js`,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.jsx': 'jsx', '.js': 'jsx', '.css': 'empty',
            '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.gif': 'dataurl' },
  define,
  minify: true,
  target: 'es2020',
  logLevel: 'info',
})

console.log('Building CSS with esbuild...')
await esbuild.build({
  entryPoints: ['src/index.css'],
  bundle: true,
  outdir,
  entryNames: 'index-[hash]',
  minify: true,
  logLevel: 'info',
})

const cssFile = fs.readdirSync(outdir).find(f => f.endsWith('.css')) || ''

// Env vars injected as inline window.__env before the app script runs
const supabaseUrl  = process.env.VITE_SUPABASE_URL || ''
const supabaseKey  = process.env.VITE_SUPABASE_ANON_KEY || ''
const brevoKey     = process.env.VITE_BREVO_API_KEY || ''
const censusKey    = process.env.VITE_CENSUS_API_KEY || ''
const mapboxToken  = process.env.VITE_MAPBOX_TOKEN || ''

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Club Locator</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    ${cssFile ? `<link rel="stylesheet" crossorigin href="/assets/${cssFile}">` : ''}
    <script>window.__env={VITE_SUPABASE_URL:"${supabaseUrl}",VITE_SUPABASE_ANON_KEY:"${supabaseKey}",VITE_BREVO_API_KEY:"${brevoKey}",VITE_CENSUS_API_KEY:"${censusKey}",VITE_MAPBOX_TOKEN:"${mapboxToken}"};</script>
  </head>
  <body>
    <div id="root">
      <div id="app-init-loader" style="position:fixed;inset:0;background:#f5f7f5;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#888;">Loading\u2026</div>
    </div>
    <script type="module" src="/assets/main-bundle.js"></script>
  </body>
</html>`

fs.writeFileSync('dist/index.html', html)
console.log('Build complete! CSS:', cssFile)
