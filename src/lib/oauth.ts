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
export const BSKY_POST_SCOPE = 'atproto repo:app.bsky.feed.post?action=create';
// Full CRUD on your own whtwnd blog entries. atproto-oauth has no
// ?action=* wildcard — the spec only defines create/update/delete — so
// we list all three explicitly. Requesting a scope not in the client
// metadata (or unknown to the pds) gets silently dropped, which surfaces
// as a consent screen showing only "atproto" and no custom scopes.
export const WHTWND_SCOPE = [
  'atproto',
  'repo:com.whtwnd.blog.entry?action=create',
  'repo:com.whtwnd.blog.entry?action=update',
  'repo:com.whtwnd.blog.entry?action=delete',
].join(' ');
// PDF-uploader lab writes + deletes com.imlunahey.pdf records (blob
// uploads go through the same session and don't need their own scope).
// Listed as create + delete so the editor can manage existing records.
export const PDF_SCOPE = [
  'atproto',
  'repo:com.imlunahey.pdf?action=create',
  'repo:com.imlunahey.pdf?action=delete',
].join(' ');
// ListCleaner lab deletes dead app.bsky.graph.listblock records; the
// listRecords read to find them doesn't need an extra scope (atproto
// grants base read). Delete-only keeps the consent screen honest.
export const LISTBLOCK_SCOPE = 'atproto repo:app.bsky.graph.listblock?action=delete';

/**
 * The specific repo scope strings that a token MUST carry to write the
 * relevant collection. Used to check a session before showing "publish"
 * actions — a session authorised under GUESTBOOK_SCOPE has `atproto` and
 * the guestbook scope but NOT the leaderboard one, so attempting to post
 * a score would fail with ScopeMissingError.
 */
export const GUESTBOOK_WRITE_SCOPE = 'repo:com.imlunahey.guestbook.entry?action=create';
export const GUESTBOOK_UPDATE_SCOPE = 'repo:com.imlunahey.guestbook.entry?action=update';
export const GUESTBOOK_DELETE_SCOPE = 'repo:com.imlunahey.guestbook.entry?action=delete';
export const LEADERBOARD_WRITE_SCOPE = 'repo:com.imlunahey.leaderboard.score?action=create';
export const LEADERBOARD_UPDATE_SCOPE = 'repo:com.imlunahey.leaderboard.score?action=update';
export const LEADERBOARD_DELETE_SCOPE = 'repo:com.imlunahey.leaderboard.score?action=delete';
export const BSKY_POST_WRITE_SCOPE = 'repo:app.bsky.feed.post?action=create';
export const BSKY_POST_UPDATE_SCOPE = 'repo:app.bsky.feed.post?action=update';
export const BSKY_POST_DELETE_SCOPE = 'repo:app.bsky.feed.post?action=delete';
// sessionHasScope does exact-string matching, so we pick the "create"
// variant as the gate — a token granted update/delete without create is
// useless for the editor anyway.
export const WHTWND_WRITE_SCOPE = 'repo:com.whtwnd.blog.entry?action=create';
export const WHTWND_UPDATE_SCOPE = 'repo:com.whtwnd.blog.entry?action=update';
export const WHTWND_DELETE_SCOPE = 'repo:com.whtwnd.blog.entry?action=delete';
export const PDF_WRITE_SCOPE = 'repo:com.imlunahey.pdf?action=create';
export const PDF_DELETE_SCOPE = 'repo:com.imlunahey.pdf?action=delete';
export const LISTBLOCK_DELETE_SCOPE = 'repo:app.bsky.graph.listblock?action=delete';

export function sessionHasScope(session: Session | null, scope: string): boolean {
  if (!session) return false;
  const granted = (session.token?.scope ?? '').split(/\s+/);
  return granted.includes(scope);
}

/**
 * Plural — return true only when every scope in `scopes` is in the
 * granted set. Use from lab gates to require the full set of scopes a
 * lab actually exercises, not just a representative one. Catches
 * stale sessions that authorised an older (narrower) scope bundle.
 */
export function sessionHasScopes(session: Session | null, scopes: string[]): boolean {
  if (!session) return false;
  const granted = new Set((session.token?.scope ?? '').split(/\s+/));
  return scopes.every((s) => granted.has(s));
}

/**
 * Union of all scopes this client may ever request — advertised on the
 * loopback client_id and in the hosted client-metadata.json. Individual
 * features still narrow the scope they actually request at auth time.
 */
/**
 * Every scope this client may ever request. Exported so the
 * /oauth/client-metadata.json server route can stamp it into the hosted
 * client metadata — the old approach (hand-editing a static JSON file
 * after every new feature) broke every third deploy because someone
 * would forget to touch both this list AND the static json.
 *
 * Adding a scope: add to the per-feature constants above AND below. The
 * metadata endpoint updates automatically on deploy.
 */
export const ALL_SCOPES = [
  'atproto',
  GUESTBOOK_WRITE_SCOPE,
  GUESTBOOK_UPDATE_SCOPE,
  GUESTBOOK_DELETE_SCOPE,
  LEADERBOARD_WRITE_SCOPE,
  LEADERBOARD_UPDATE_SCOPE,
  LEADERBOARD_DELETE_SCOPE,
  BSKY_POST_WRITE_SCOPE,
  BSKY_POST_UPDATE_SCOPE,
  BSKY_POST_DELETE_SCOPE,
  WHTWND_WRITE_SCOPE,
  WHTWND_UPDATE_SCOPE,
  WHTWND_DELETE_SCOPE,
  PDF_WRITE_SCOPE,
  PDF_DELETE_SCOPE,
  LISTBLOCK_DELETE_SCOPE,
].join(' ');

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
