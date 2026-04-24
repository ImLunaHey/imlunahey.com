import { createFileRoute } from '@tanstack/react-router';

/**
 * SSE proxy for Mastodon public timelines.
 *
 * Mastodon instances expose /api/v1/streaming/public as Server-Sent
 * Events without CORS headers on most installs, so browsers can't
 * subscribe directly. This route runs on our edge worker, opens the
 * upstream stream, and pipes it back with permissive CORS.
 *
 *   GET /api/mastodon-stream?instance=mastodon.social&scope=federated
 *
 * `scope` is optional — 'federated' (default) or 'local'.
 * `instance` must be a hostname (no paths, no protocol).
 */

const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

function badRequest(msg: string): Response {
  return new Response(msg, { status: 400, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' } });
}

export const Route = createFileRoute('/api/mastodon-stream')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const instance = url.searchParams.get('instance')?.trim().toLowerCase();
        const scope = url.searchParams.get('scope') === 'local' ? 'local' : 'federated';
        if (!instance || !HOST_RE.test(instance)) return badRequest('instance must be a hostname');

        const upstream = `https://${instance}/api/v1/streaming/public${scope === 'local' ? '/local' : ''}`;
        const upstreamResp = await fetch(upstream, {
          headers: { accept: 'text/event-stream', 'user-agent': 'imlunahey.com/1.0 mastodon-stream-proxy' },
          signal: request.signal,
        });

        if (!upstreamResp.ok || !upstreamResp.body) {
          return new Response(`upstream ${upstreamResp.status}`, {
            status: 502,
            headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' },
          });
        }

        return new Response(upstreamResp.body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'x-accel-buffering': 'no',
          },
        });
      },
    },
  },
});
