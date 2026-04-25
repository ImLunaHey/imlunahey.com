import serverEntry from '@tanstack/react-start/server-entry';

export { PresenceDO } from './server/presence-do';
export { AtriumDO } from './server/atrium-do';

/**
 * Paths that must always hit the worker fresh — OAuth callbacks, server-fn
 * RPCs, and any endpoint that reads cookies / session state. Adding a path
 * here is always safe; removing one silently risks serving stale/shared
 * data to the wrong user, so err on the side of listing too much.
 */
function neverCache(path: string): boolean {
  return (
    path.startsWith('/oauth/') ||
    path.startsWith('/_serverFn/') ||
    path.startsWith('/api/') ||
    path === '/sitemap.xml' // has its own long-cache in its route handler
  );
}

/**
 * Wraps TanStack's server-entry to add a short edge-cache window on SSR'd
 * HTML responses. The worker still runs + SSRs on a cold edge — first
 * visitor pays the full SSR cost (~500ms TTFB) — but subsequent visitors
 * within the TTL window get the cached HTML from Cloudflare's edge (~30ms
 * TTFB). Freshness cost: data is at most `s-maxage` seconds stale.
 *
 * We only touch responses that:
 *  - are successful GETs
 *  - are HTML (avoid API/JSON)
 *  - don't already have a cache-control header (route handlers that set
 *    their own policy win)
 *  - don't live on a never-cache path above
 *
 * max-age=0 means browsers revalidate on every navigation; s-maxage is the
 * edge-only TTL, and stale-while-revalidate lets the edge serve slightly
 * stale HTML while it re-fetches in the background.
 */
const EDGE_CACHE_TTL_SECS = 60;
const STALE_WHILE_REVALIDATE_SECS = 300;

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    // Atrium websocket endpoint — intercept BEFORE serverEntry sees it,
    // because the TanStack runtime doesn't propagate the `webSocket` field
    // on Response init that CF needs for a 101 upgrade.
    const url = new URL(request.url);
    if (url.pathname === '/api/atrium-ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      const e = env as { ATRIUM_DO: DurableObjectNamespace };
      const id = e.ATRIUM_DO.idFromName('global-v1');
      const stub = e.ATRIUM_DO.get(id) as unknown as { fetch(req: Request): Promise<Response> };
      return stub.fetch(request);
    }

    // @tanstack/react-start's fetch signature accepts the CF invocation
    // tuple as varargs — the library unwraps whatever we pass.
    const response = await (serverEntry.fetch as (req: Request, ...rest: unknown[]) => Promise<Response>)(
      request,
      env,
      ctx,
    );

    if (
      request.method !== 'GET' ||
      !response.ok ||
      response.headers.has('cache-control') ||
      response.headers.has('set-cookie') || // never cache a response that sets a session/auth cookie
      !response.headers.get('content-type')?.includes('text/html')
    ) {
      return response;
    }

    const path = new URL(request.url).pathname;
    if (neverCache(path)) return response;

    const headers = new Headers(response.headers);
    headers.set(
      'cache-control',
      `public, max-age=0, s-maxage=${EDGE_CACHE_TTL_SECS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECS}`,
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
