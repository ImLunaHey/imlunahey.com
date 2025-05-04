import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { compareScreenshot } from './src/tests/commands/screenshot';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    setupFiles: ['./src/tests/setup/vitest.setup.ts', './src/tests/setup/matchers.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      commands: {
        compareScreenshot,
      },
      ui: false,
      viewport: {
        width: 1280,
        height: 720,
      },
    },
    css: true,
  },
});
