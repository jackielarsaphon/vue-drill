import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// GitHub Pages has no SPA rewrite rule and ignores public/_redirects, so it
// serves 404.html for any deep link. Shipping index.html under that name lets
// the router take over instead of showing GitHub's 404.
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
  base: '/vue-drill/',
  build: {
    chunkSizeWarningLimit: 3000,
  },
});
