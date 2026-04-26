import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { SiteStatus } from '../../server/site-status';

/**
 * /api/status — read + write the live site-status state.
 *
 *   GET                         → current SiteStatus or null
 *   POST  body: { dnd, focus?, backAt? }
 *         header: Authorization: Bearer SITE_STATUS_TOKEN
 *
 * The POST is intended to be called from an iOS Shortcuts personal-
 * automation when entering / leaving Focus or Sleep modes. Only the
 * bearer-token check guards it — the worst case for a leaked token is
 * a stranger toggling whether luna's home-page status pill says "DND"
 * for a few minutes, so HMAC + replay protection isn't worth the
 * complexity.
 *
 * The token isn't required for GET so the page loader can hit it
 * unauthenticated (and so the user can paste the URL into a browser
 * to verify what's currently stored).
 */

const KV_KEY = 'site:status';

export const Route = createFileRoute('/api/status')({
  server: {
    handlers: {
      GET: async () => {
        const kv = env.HOMELAB;
        if (!kv) return Response.json(null, { status: 503 });
        const blob = await kv.get<SiteStatus>(KV_KEY, { type: 'json' });
        return Response.json(blob ?? null);
      },
      POST: async ({ request }: { request: Request }) => {
        const token = process.env.SITE_STATUS_TOKEN;
        if (!token) return new Response('no token configured', { status: 503 });

        const auth = request.headers.get('authorization') ?? '';
        const sent = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (sent !== token) return new Response('unauthorized', { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response('invalid json', { status: 400 });
        }
        if (typeof body !== 'object' || body === null) {
          return new Response('body must be an object', { status: 400 });
        }
        const b = body as { dnd?: unknown; focus?: unknown; backAt?: unknown };
        if (typeof b.dnd !== 'boolean') {
          return new Response('dnd must be a boolean', { status: 400 });
        }
        const next: SiteStatus = {
          dnd: b.dnd,
          focus: typeof b.focus === 'string' ? b.focus : undefined,
          backAt: typeof b.backAt === 'string' ? b.backAt : undefined,
          ts: Date.now(),
        };

        const kv = env.HOMELAB;
        if (!kv) return new Response('no kv binding', { status: 503 });
        await kv.put(KV_KEY, JSON.stringify(next));
        return Response.json({ ok: true, status: next });
      },
    },
  },
});
