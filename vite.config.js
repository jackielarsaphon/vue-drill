import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// GitHub Pages serves the app from /vue-drill/; every other host serves it
// from the domain root. The GitHub Pages workflow leaves VITE_BASE_PATH unset.
const base = process.env.VITE_BASE_PATH || '/vue-drill/';

// Top-level route paths ('user-access', …), read from the router so the list
// can't drift from it.
function routePaths() {
  const src = readFileSync(resolve(__dirname, 'src/router/index.ts'), 'utf8');
  return [...src.matchAll(/path:\s*'\/([a-z0-9-]+)'/g)].map((m) => m[1]);
}

// Hosts without an SPA rewrite rule (GitHub Pages) have no file behind a deep
// link. GitHub Pages serves /<name> from <name>.html with a 200, so ship
// index.html under every route name and a refresh loads the app directly;
// 404.html still catches any other path (with a 404 status). Harmless on hosts
// that do rewrite (vercel.json, _redirects).
function spaFallback() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const out = resolve(__dirname, 'dist');
      const index = resolve(out, 'index.html');
      copyFileSync(index, resolve(out, '404.html'));
      for (const p of routePaths()) copyFileSync(index, resolve(out, `${p}.html`));
    },
  };
}

export default defineConfig({
  plugins: [vue(), spaFallback()],
  base,
  build: {
    chunkSizeWarningLimit: 3000,
  },
});
