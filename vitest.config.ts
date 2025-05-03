import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { compareScreenshot } from './src/tests/commands/screenshot';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./src/tests/setup/vitest.setup.ts', './src/tests/setup/matchers.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      commands: {
        compareScreenshot,
      },
    },
    css: true,
  },
});
