import { createFileRoute } from '@tanstack/react-router';
import { buildOgSvg, type OgSlug } from '../../lib/og';

export const Route = createFileRoute('/og/$')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const raw = (params as { _splat?: string })._splat ?? 'home';
        const slug = raw.replace(/\.svg$/, '') as OgSlug;
        const svg = buildOgSvg(slug);
        // prod: cache for an hour in the browser, a day at the cdn.
        // dev: no browser cache so edits to the svg template show up fresh.
        const cacheControl = import.meta.env.DEV
          ? 'no-store'
          : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
        return new Response(svg, {
          headers: {
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': cacheControl,
          },
        });
      },
    },
  },
});
