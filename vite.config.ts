import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import metaMapPlugin from 'vite-plugin-react-meta-map';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ registerType: 'autoUpdate' }),
    metaMapPlugin({
      pageMetaMapFilePath: './src/og/page-meta-map.ts',
      pageTemplateFilePath: './src/og/PageTemplate.tsx',
    }),
  ],
});
