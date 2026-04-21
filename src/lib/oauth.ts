import { configureOAuth, deleteStoredSession, getSession, listStoredSessions } from '@atcute/oauth-browser-client';
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import type { Session } from '@atcute/oauth-browser-client';

/**
 * OAuth scope for the guestbook. `atproto` is the base scope; the nsid
 * grants write access scoped to just this collection, so we only get
 * permission to createRecord on com.imlunahey.guestbook.entry (not the
 * whole repo).
 */
export const OAUTH_SCOPE = 'atproto com.imlunahey.guestbook.entry';

/**
 * In prod the client_id is the URL of our hosted metadata JSON.
 * In dev we use atproto's loopback-client pattern: client_id is a URL on
 * `http://127.0.0.1` with the metadata encoded as query params, which
 * PDSes accept without fetching anything. Keeps dev free of tunnels.
 */
function oauthEndpoints(): { clientId: string; redirectUri: string } {
  if (typeof window === 'undefined') {
    // ssr — values don't matter here because we only call configureOAuth
    // in the browser, but we need something parseable to silence ssr.
    return { clientId: 'https://imlunahey.com/oauth/client-metadata.json', redirectUri: 'https://imlunahey.com/oauth/callback' };
  }
  const origin = window.location.origin;
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  if (isLoopback) {
    // Keep the redirect_uri on the exact host the user visited — if we
    // normalize localhost → 127.0.0.1, the callback lands on a different
    // origin than the sign-in page, and the state/dpop-key in storage
    // is unreachable (browsers partition storage per origin).
    const redirectUri = `${origin}/oauth/callback`;
    const params = new URLSearchParams({ redirect_uri: redirectUri, scope: OAUTH_SCOPE });
    return { clientId: `http://localhost?${params.toString()}`, redirectUri };
  }
  return {
    clientId: `${origin}/oauth/client-metadata.json`,
    redirectUri: `${origin}/oauth/callback`,
  };
}

let configured = false;
export function ensureOAuthConfigured(): { clientId: string; redirectUri: string } {
  const endpoints = oauthEndpoints();
  if (configured || typeof window === 'undefined') return endpoints;
  configureOAuth({
    metadata: { client_id: endpoints.clientId, redirect_uri: endpoints.redirectUri },
    identityResolver: new LocalActorResolver({
      handleResolver: new CompositeHandleResolver({
        strategy: 'race',
        methods: {
          dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
          http: new WellKnownHandleResolver({}),
        },
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver(),
          web: new WebDidDocumentResolver(),
        },
      }),
    }),
    storageName: 'imlunahey-oauth',
  });
  configured = true;
  return endpoints;
}

/** Pull the most recently stored session (if any), refreshing if needed. */
export async function getCurrentSession(): Promise<Session | null> {
  ensureOAuthConfigured();
  const dids = listStoredSessions();
  if (dids.length === 0) return null;
  try {
    return await getSession(dids[0], { allowStale: false });
  } catch {
    // tokens couldn't be refreshed — treat as signed-out
    try {
      deleteStoredSession(dids[0]);
    } catch {
      /* ignore */
    }
    return null;
  }
}
