import { createFileRoute } from '@tanstack/react-router';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
// `?module` suffix asks the bundler for a compiled WebAssembly.Module
// instead of a fetch-able URL — Cloudflare Workers accept the module
// directly via initWasm.
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm?module';
import { buildOgSvg, type OgSlug } from '../../lib/og';

// One-time wasm init per isolate. In dev, HMR may reload this module
// after the wasm runtime is already initialized — resvg throws in that
// case, which we can safely treat as success (the module is still live).
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = initWasm(wasmModule as unknown as WebAssembly.Module).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Already initialized')) return;
      throw err;
    });
  }
  return initPromise;
}

// Font buffer: fetched lazily from our own /fonts/ path on first request
// per isolate, then kept in module scope. ~200kb for JetBrains Mono TTF.
let fontPromise: Promise<Uint8Array | null> | null = null;
function getFont(reqUrl: string): Promise<Uint8Array | null> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const res = await fetch(new URL('/fonts/jetbrains-mono.ttf', reqUrl));
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch {
        return null;
      }
    })();
  }
  return fontPromise;
}

export const Route = createFileRoute('/og/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // CDN cache: in prod, reuse rendered PNGs across requests until the
        // underlying template changes. In dev we always re-render so template
        // edits show up immediately.
        const cache = caches.default;
        if (!import.meta.env.DEV) {
          const hit = await cache.match(request);
          if (hit) return hit;
        }

        const raw = (params as { _splat?: string })._splat ?? 'home';
        // strip either .svg (legacy) or .png from the slug so old links still
        // resolve to the new format.
        const slug = raw.replace(/\.(svg|png)$/, '') as OgSlug;
        const svg = buildOgSvg(slug);

        await ensureInit();
        const font = await getFont(request.url);

        const resvg = new Resvg(svg, {
          background: '#000000',
          fitTo: { mode: 'width', value: 1200 },
          font: font
            ? {
                fontBuffers: [font],
                // override resvg's built-in fallbacks so our ui-monospace /
                // "JetBrains Mono" css stacks resolve to the bundled font.
                defaultFontFamily: 'JetBrains Mono',
                monospaceFamily: 'JetBrains Mono',
                sansSerifFamily: 'JetBrains Mono',
                serifFamily: 'JetBrains Mono',
              }
            : undefined,
          textRendering: 1, // optimizeLegibility
          shapeRendering: 2, // geometricPrecision
        });
        const png = resvg.render().asPng();

        const cacheControl = import.meta.env.DEV
          ? 'no-store'
          : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';

        const response = new Response(png, {
          headers: {
            'content-type': 'image/png',
            'cache-control': cacheControl,
          },
        });

        if (!import.meta.env.DEV) {
          // Clone before putting so the response body can still be read by
          // the client (streams are single-use).
          await cache.put(request, response.clone());
        }
        return response;
      },
    },
  },
});
