import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  // bind to 0.0.0.0 so both http://localhost:5173 and http://127.0.0.1:5173
  // resolve. atproto's loopback oauth flow requires 127.0.0.1 (some PDSes
  // reject `localhost`), so the dev flow lives on that host.
  server: { host: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
    }),
    react(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
  ],
});
