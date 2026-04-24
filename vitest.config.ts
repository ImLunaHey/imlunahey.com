import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // the dev/build pipeline uses @cloudflare/vite-plugin, which registers
      // the `cloudflare:workers` virtual module. vitest doesn't load that
      // plugin, so any client code that transitively imports server fns
      // fails to resolve. alias it to a stub so tests can at least build
      // the module graph; the stub throws if server code actually runs.
      'cloudflare:workers': fileURLToPath(new URL('./src/tests/setup/cloudflare-workers-stub.ts', import.meta.url)),
      // same shape of problem: the og route imports a .wasm file via vite's
      // `?module` query. node's ESM loader has no handler for it, so any
      // test that pulls in the full route tree fails to import.
      '@resvg/resvg-wasm/index_bg.wasm?module': fileURLToPath(new URL('./src/tests/setup/resvg-wasm-stub.ts', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./src/tests/setup/vitest.setup.ts'],
    environment: 'happy-dom',
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
    server: {
      deps: {
        inline: ['codemirror-json-schema'],
      },
    },
  },
});
