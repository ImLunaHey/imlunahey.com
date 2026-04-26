import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { HealthSnapshot } from '../../server/health';

/**
 * /api/health — receive a Health Auto Export JSON push from iOS.
 *
 *   GET                              → current snapshot (or null)
 *   POST  Authorization: Bearer HEALTH_TOKEN
 *         body: { data: { metrics, workouts } }   (HAE schema)
 *
 * HAE's "REST API" output mode is the expected source. Configure it
 * to POST to https://imlunahey.com/api/health with the bearer token
 * in `Authorization` and the standard JSON shape; tick whichever
 * metrics + workouts you want surfaced. The store overwrites — each
 * push replaces the previous snapshot — so set HAE's "Aggregate Data"
 * window to whatever history you want the page to render (7 / 30 /
 * 90 days are sensible defaults).
 *
 * Token-only auth (no HMAC) is fine for the personal-site threat
 * model: the worst a leaked token could do is overwrite the snapshot
 * with junk, which you'd notice immediately and rotate.
 */

const KV_KEY = 'health:latest';

type HaeBody = {
  data?: {
    metrics?: Array<{ name?: string; units?: string; data?: unknown[] }>;
    workouts?: unknown[];
  };
};

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const kv = env.HOMELAB;
        if (!kv) return Response.json(null, { status: 503 });
        const blob = await kv.get<HealthSnapshot>(KV_KEY, { type: 'json' });
        return Response.json(blob ?? null);
      },
      POST: async ({ request }: { request: Request }) => {
        const token = process.env.HEALTH_TOKEN;
        if (!token) return new Response('no token configured', { status: 503 });

        const auth = request.headers.get('authorization') ?? '';
        const sent = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (sent !== token) return new Response('unauthorized', { status: 401 });

        let body: HaeBody;
        try {
          body = (await request.json()) as HaeBody;
        } catch {
          return new Response('invalid json', { status: 400 });
        }

        // HAE wraps the payload in `data: { metrics, workouts }`. We
        // tolerate either shape — flat or wrapped — so a curl test
        // doesn't have to mimic HAE perfectly.
        const wrapped = body.data ?? (body as unknown as HaeBody['data']);
        const metrics = (wrapped?.metrics ?? []) as HealthSnapshot['metrics'];
        const workouts = (wrapped?.workouts ?? []) as HealthSnapshot['workouts'];

        const snap: HealthSnapshot = {
          ts: Date.now(),
          metrics,
          workouts,
        };

        const kv = env.HOMELAB;
        if (!kv) return new Response('no kv binding', { status: 503 });
        await kv.put(KV_KEY, JSON.stringify(snap));
        return Response.json({
          ok: true,
          metrics: metrics.length,
          workouts: workouts.length,
          ts: snap.ts,
        });
      },
    },
  },
});
