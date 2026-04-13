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

// Copy all public/ files to dist
if (fs.existsSync('public')) {
  fs.readdirSync('public').forEach(f => {
    fs.copyFileSync(`public/${f}`, `dist/${f}`)
  })
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>My Club Locator</title>
    <meta name="description" content="The community-powered map where Nutrition Club owners get discovered, connect, and grow." />
    <meta name="theme-color" content="#1A3C2E" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ClubLocator" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="msapplication-TileColor" content="#1A3C2E" />
    <meta name="msapplication-TileImage" content="/icon-144.png" />
    <meta property="og:title" content="My Club Locator" />
    <meta property="og:description" content="The community-powered map where Nutrition Club owners get discovered, connect, and grow." />
    <meta property="og:image" content="https://myclublocator.com/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://myclublocator.com" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="My Club Locator" />
    <meta name="twitter:description" content="The community-powered map where Nutrition Club owners get discovered, connect, and grow." />
    <meta name="twitter:image" content="https://myclublocator.com/og-image.png" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
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
