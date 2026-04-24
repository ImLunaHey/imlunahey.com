/**
 * Shared helpers for the constellation-backed labs (top-posts,
 * list-memberships, engagement-timeline, labels, quote-tree, reply-
 * ratio, top-domains, and the main backlinks lab as future refactors).
 *
 * Keeps the per-lab pages tight + ensures every lab queries
 * constellation and the public AppView the same way.
 */

import { simpleFetchHandler, XRPC } from '@atcute/client';

// Public AppView — read-only, no auth. Shared module-scope instance so
// every call site reuses the same XRPC client.
export const pubRpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

// ─── types ─────────────────────────────────────────────────────────────────

export type Backlink = { did: string; collection: string; rkey: string };

export type ProfileView = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
};

export type PostView = {
  uri: string;
  cid: string;
  author: ProfileView;
  record: {
    text?: string;
    createdAt?: string;
    reply?: { parent?: { uri: string }; root?: { uri: string } };
    embed?: {
      $type?: string;
      external?: { uri: string; title?: string; description?: string };
      record?: { uri: string };
    };
  };
  indexedAt?: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
};

// ─── constellation ─────────────────────────────────────────────────────────

const CONSTELLATION = 'https://constellation.microcosm.blue';

/**
 * Paginated backlinks query. Constellation's limit max is 100; for most
 * labs we only need the first page. Swallows network failures + returns
 * an empty list so a downed community instance doesn't break the whole
 * lab — consumers should also show a "referenced by constellation"
 * hint so empty results aren't misread as "no refs exist".
 */
export async function fetchBacklinks(
  subject: string,
  source: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ records: Backlink[]; total: number; cursor: string | null }> {
  try {
    const url = new URL(`${CONSTELLATION}/xrpc/blue.microcosm.links.getBacklinks`);
    url.searchParams.set('subject', subject);
    url.searchParams.set('source', source);
    url.searchParams.set('limit', String(opts.limit ?? 100));
    if (opts.cursor) url.searchParams.set('cursor', opts.cursor);
    const r = await fetch(url.toString());
    if (!r.ok) return { records: [], total: 0, cursor: null };
    const j = (await r.json()) as { records?: Backlink[]; total?: number; cursor?: string | null };
    return {
      records: j.records ?? [],
      total: j.total ?? (j.records?.length ?? 0),
      cursor: j.cursor ?? null,
    };
  } catch {
    return { records: [], total: 0, cursor: null };
  }
}

/**
 * Count-only endpoint — way cheaper than paginating all backlinks when we
 * only need the total. used by top-posts / engagement-timeline / reply-
 * ratio where we aggregate counts across many subjects.
 */
export async function fetchBacklinksCount(subject: string, source: string): Promise<number> {
  try {
    const url = new URL(`${CONSTELLATION}/xrpc/blue.microcosm.links.getBacklinksCount`);
    url.searchParams.set('subject', subject);
    url.searchParams.set('source', source);
    const r = await fetch(url.toString());
    if (!r.ok) return 0;
    const j = (await r.json()) as { total?: number };
    return j.total ?? 0;
  } catch {
    return 0;
  }
}

// ─── appview hydration ─────────────────────────────────────────────────────

/**
 * Batched app.bsky.actor.getProfiles. getProfiles caps at 25 actors per
 * call; chunks silently + tolerates partial failures.
 */
export async function fetchProfiles(dids: string[]): Promise<Map<string, ProfileView>> {
  const out = new Map<string, ProfileView>();
  const unique = [...new Set(dids)];
  for (let i = 0; i < unique.length; i += 25) {
    const batch = unique.slice(i, i + 25);
    try {
      const r = await pubRpc.get('app.bsky.actor.getProfiles', { params: { actors: batch } });
      const profiles = (r.data as unknown as { profiles: ProfileView[] }).profiles ?? [];
      for (const p of profiles) out.set(p.did, p);
    } catch { /* tolerate partial hydration failures */ }
  }
  return out;
}

/**
 * Single-profile lookup — used when the input is a handle we need to
 * resolve to a DID before querying constellation.
 */
export async function fetchProfile(actor: string): Promise<ProfileView | null> {
  try {
    const r = await pubRpc.get('app.bsky.actor.getProfile', { params: { actor } });
    return r.data as ProfileView;
  } catch {
    return null;
  }
}

/**
 * Batched app.bsky.feed.getPosts. Caps at 25 per call.
 */
export async function fetchPosts(uris: string[]): Promise<Map<string, PostView>> {
  const out = new Map<string, PostView>();
  const unique = [...new Set(uris)];
  for (let i = 0; i < unique.length; i += 25) {
    const batch = unique.slice(i, i + 25);
    try {
      const r = await pubRpc.get('app.bsky.feed.getPosts', { params: { uris: batch } });
      const posts = (r.data as unknown as { posts: PostView[] }).posts ?? [];
      for (const p of posts) out.set(p.uri, p);
    } catch { /* tolerate partial hydration failures */ }
  }
  return out;
}

/**
 * Author feed pager. `filter` kept permissive so callers can choose
 * posts-only vs posts-and-replies. Returns raw posts array.
 */
export async function fetchAuthorFeed(
  actor: string,
  opts: { limit?: number; filter?: 'posts_with_replies' | 'posts_no_replies' | 'posts_and_author_threads' } = {},
): Promise<PostView[]> {
  try {
    const r = await pubRpc.get('app.bsky.feed.getAuthorFeed', {
      params: {
        actor,
        limit: opts.limit ?? 100,
        filter: opts.filter ?? 'posts_and_author_threads',
      },
    });
    const feed = (r.data as unknown as { feed: Array<{ post: PostView }> }).feed ?? [];
    return feed.map((f) => f.post);
  } catch {
    return [];
  }
}

// ─── url helpers ───────────────────────────────────────────────────────────

export function bskyPostWebUrl(post: PostView): string {
  const rkey = post.uri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${post.author.did}/post/${rkey}`;
}

export function bskyProfileWebUrl(did: string): string {
  return `https://bsky.app/profile/${did}`;
}

/**
 * Accept either a handle (bluesky.social, myhandle, etc.), a did, or an
 * at-uri whose authority is a DID. Returns the resolved DID or null if
 * the input can't be resolved via getProfile.
 */
export async function resolveToDid(input: string): Promise<string | null> {
  const s = input.trim().replace(/^@/, '');
  if (s.startsWith('did:')) return s;
  if (s.startsWith('at://')) {
    const authority = s.slice(5).split('/')[0] ?? '';
    if (authority.startsWith('did:')) return authority;
    // at-uri authority is sometimes a handle (legacy) — fall through to
    // getProfile which also accepts handles.
    const p = await fetchProfile(authority);
    return p?.did ?? null;
  }
  const p = await fetchProfile(s);
  return p?.did ?? null;
}

// ─── labeler resolution / querying ─────────────────────────────────────────

type DidDoc = { service?: Array<{ id: string; type: string; serviceEndpoint: string }> };

async function fetchDidDoc(did: string): Promise<DidDoc | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const r = await fetch(`https://plc.directory/${did}`);
      if (!r.ok) return null;
      return (await r.json()) as DidDoc;
    }
    if (did.startsWith('did:web:')) {
      const host = did.slice('did:web:'.length);
      const r = await fetch(`https://${host}/.well-known/did.json`);
      if (!r.ok) return null;
      return (await r.json()) as DidDoc;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Given a handle or DID, return the full labeler info. Labelers declare
 * their ozone service via an `#atproto_labeler` entry in their DID doc.
 * Returns null if the identity doesn't run a labeler service.
 */
export async function resolveLabeler(handleOrDid: string): Promise<{ did: string; handle: string; endpoint: string } | null> {
  const did = await resolveToDid(handleOrDid);
  if (!did) return null;
  const doc = await fetchDidDoc(did);
  const endpoint = doc?.service?.find((s) => s.type === 'AtprotoLabeler')?.serviceEndpoint;
  if (!endpoint) return null;
  const prof = await fetchProfile(did);
  return { did, handle: prof?.handle ?? did, endpoint };
}

export type LabelFromLabeler = {
  ver?: number;
  src: string;
  uri: string;
  cid?: string;
  val: string;
  neg?: boolean;
  cts: string;
  exp?: string;
};

/**
 * Query a labeler's ozone service for labels targeting a specific subject
 * (DID or at-uri). Public endpoint, no auth.
 *
 * Hard 10s timeout — a small community labeler with a flaky ozone
 * shouldn't stall the page indefinitely. Callers treat both failure
 * modes (aborted vs. non-2xx) the same: empty result set.
 */
export async function queryLabelerForSubject(endpoint: string, subject: string): Promise<LabelFromLabeler[]> {
  try {
    const url = new URL(`${endpoint.replace(/\/$/, '')}/xrpc/com.atproto.label.queryLabels`);
    url.searchParams.set('uriPatterns', subject);
    url.searchParams.set('limit', '100');
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { labels?: LabelFromLabeler[] };
    return j.labels ?? [];
  } catch {
    return [];
  }
}

// ─── tid time decoding ─────────────────────────────────────────────────────

const TID_ALPHA = '234567abcdefghijklmnopqrstuvwxyz';

/**
 * Decode a TID-shaped rkey back to its embedded timestamp.
 *
 * TID format (atproto spec): 13 chars, base32-sortable, encoding a
 * microsecond timestamp + 10-bit clock id. We drop the clock id and
 * return the millisecond timestamp as a Date.
 *
 * Used by the engagement-timeline lab to bucket backlinks by when they
 * were created, without having to fetch every record.
 */
export function tidToDate(tid: string): Date | null {
  if (tid.length !== 13) return null;
  let n = 0n;
  for (const ch of tid) {
    const v = TID_ALPHA.indexOf(ch);
    if (v < 0) return null;
    n = (n << 5n) | BigInt(v);
  }
  // clear the top bit (always 0) then shift off the 10-bit clock id
  const micros = (n & ((1n << 64n) - 1n)) >> 10n;
  const ms = Number(micros / 1000n);
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}
