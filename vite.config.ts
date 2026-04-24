import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';

const analyse = process.env.ANALYSE === '1';

// Stamped into the bundle at build time. Used by /humans.txt for the
// "last update" line. Prefers the author-date of HEAD (YYYY-MM-DD) so
// the number reflects what's actually deployed, not the builder's clock.
let buildDate: string;
try {
  buildDate = execSync('git log -1 --format=%aI', { encoding: 'utf8' }).trim().slice(0, 10);
} catch {
  buildDate = new Date().toISOString().slice(0, 10);
}

export default defineConfig({
  // bind to 0.0.0.0 so both http://localhost:5173 and http://127.0.0.1:5173
  // resolve. atproto's loopback oauth flow requires 127.0.0.1 (some PDSes
  // reject `localhost`), so the dev flow lives on that host.
  server: { host: true },
  // Heavy route-split chunks (pdfjs, mediabunny, codemirror for car-explorer)
  // legitimately exceed 500kB, but only load when their route is visited. The
  // default 500kB warning noise obscures the chunks we actually care about.
  build: { chunkSizeWarningLimit: 2000 },
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
    }),
    react(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    analyse && visualizer({ filename: 'dist/stats.html', template: 'treemap', gzipSize: true, brotliSize: true }),
  ].filter(Boolean) as never[],
});
