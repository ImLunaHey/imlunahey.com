import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
