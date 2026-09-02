import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// GitHub Pages serves the app from /vue-drill/; every other host serves it
// from the domain root. The GitHub Pages workflow leaves VITE_BASE_PATH unset.
const base = process.env.VITE_BASE_PATH || '/vue-drill/';

// Hosts without an SPA rewrite rule (GitHub Pages) fall through to 404.html
// for any deep link, so ship index.html under that name too and let the
// router take over. Harmless on hosts that do rewrite via _redirects.
function spaFallback() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const out = resolve(__dirname, 'dist');
      copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'));
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
