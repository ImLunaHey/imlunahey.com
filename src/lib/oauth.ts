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
 * Per-feature scopes. The client_metadata.json declares every scope this
 * client may ever request; each feature asks only for what it needs at
 * createAuthorizationUrl time — so signing into the guestbook doesn't
 * grant leaderboard access and vice versa.
 *
 * If a session authorised under one scope later hits a page needing the
 * other, createRecord will fail with `ScopeMissingError` and we prompt
 * the user to sign in again.
 */
export const GUESTBOOK_SCOPE = 'atproto repo:com.imlunahey.guestbook.entry?action=create';
export const LEADERBOARD_SCOPE = 'atproto repo:com.imlunahey.leaderboard.score?action=create';

/**
 * The specific repo scope strings that a token MUST carry to write the
 * relevant collection. Used to check a session before showing "publish"
 * actions — a session authorised under GUESTBOOK_SCOPE has `atproto` and
 * the guestbook scope but NOT the leaderboard one, so attempting to post
 * a score would fail with ScopeMissingError.
 */
export const GUESTBOOK_WRITE_SCOPE = 'repo:com.imlunahey.guestbook.entry?action=create';
export const LEADERBOARD_WRITE_SCOPE = 'repo:com.imlunahey.leaderboard.score?action=create';

export function sessionHasScope(session: Session | null, scope: string): boolean {
  if (!session) return false;
  const granted = (session.token?.scope ?? '').split(/\s+/);
  return granted.includes(scope);
}

/**
 * Union of all scopes this client may ever request — advertised on the
 * loopback client_id and in the hosted client-metadata.json. Individual
 * features still narrow the scope they actually request at auth time.
 */
const ALL_SCOPES =
  'atproto repo:com.imlunahey.guestbook.entry?action=create repo:com.imlunahey.leaderboard.score?action=create';

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
    const params = new URLSearchParams({ redirect_uri: redirectUri, scope: ALL_SCOPES });
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
