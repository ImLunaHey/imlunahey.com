import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import metaMapPlugin from 'vite-plugin-react-meta-map';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'luna',
        short_name: 'luna',
        start_url: 'https://imlunahey.com',
        description: 'a website i made',
        theme_color: '#000000',
        display: 'standalone',
        scope: '/',
        icons: [
          {
            src: 'https://imlunahey.com/logo.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any maskable',
          },
          {
            src: 'https://imlunahey.com/logo.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'blog',
            short_name: 'blog',
            url: 'https://imlunahey.com/blog',
          },
          {
            name: 'projects',
            short_name: 'projects',
            url: 'https://imlunahey.com/projects',
          },
          {
            name: 'gallery',
            short_name: 'gallery',
            url: 'https://imlunahey.com/gallery',
          },
          {
            name: 'contact',
            short_name: 'contact',
            url: 'https://imlunahey.com/contact',
          },
        ],
        background_color: '#000000',
        lang: 'en',
      },
    }),
    metaMapPlugin({
      pageMetaMapFilePath: './src/og/page-meta-map.ts',
      pageTemplateFilePath: './src/og/PageTemplate.tsx',
    }),
  ],
});
