import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://zuzzkins.com',
  output: 'static',
  build: {
    assets: '_assets',
  },
  compressHTML: true,
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
