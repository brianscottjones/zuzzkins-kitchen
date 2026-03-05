import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://zuzzkinskitchen.com',
  // In Astro 5, 'static' output supports prerender=false on individual routes
  // We use 'server' mode with prerender=true on public pages to enable SSR for admin
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
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
