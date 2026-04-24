import { simpleFetchHandler, XRPC } from '@atcute/client';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ageInDays, archetypeFor, rarityFor } from '../../lib/bsky-cards-stats';

// Unauthenticated AppView. Every call here is a public profile/graph read —
// the same endpoints bsky.app calls for a logged-out session.
const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

type Profile = {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followsCount?: number;
  followersCount?: number;
  postsCount?: number;
  createdAt?: string;
};

type MiniProfile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
};

async function fetchProfile(actor: string): Promise<Profile> {
  const r = await rpc.get('app.bsky.actor.getProfile', { params: { actor } });
  return r.data as Profile;
}

/**
 * Turn a list of DIDs into full Profile objects with follower/post counts so
 * each mini card can render its correct rarity + HP. The AppView's getFollows
 * / getFollowers shape is a lighter ProfileView that omits counts, and without
 * counts every mini card would display as "common" — which is exactly what
 * made the binder look bland.
 *
 * getProfiles accepts up to 25 actors per call; we batch serially to stay
 * polite on the public AppView.
 */
async function enrichProfiles(dids: string[]): Promise<Profile[]> {
  if (dids.length === 0) return [];
  const out: Profile[] = [];
  for (let i = 0; i < dids.length; i += 25) {
    const batch = dids.slice(i, i + 25);
    const r = await rpc.get('app.bsky.actor.getProfiles', { params: { actors: batch } });
    const profs = (r.data as unknown as { profiles: Profile[] }).profiles;
    out.push(...profs);
  }
  return out;
}

// Hard ceiling on pagination to keep big accounts from wedging the browser.
// At 10k it's effectively "all of them" for anyone who isn't a brand —
// enrichment stays responsive because we chunk it.
const RAW_CAP = 10_000;
// Final liker ranking gets a generous window too; the real bottleneck is
// the post-sample size (40 recent posts), not this cap.
const LIKERS_CAP = 500;

/** Raw (unenriched) list of moot MiniProfiles — intersection of follows ∩ followers. */
async function fetchMootsRaw(actor: string): Promise<MiniProfile[]> {
  const [follows, followers] = await Promise.all([
    paginateGraph('app.bsky.graph.getFollows', actor, 'follows', RAW_CAP),
    paginateGraph('app.bsky.graph.getFollowers', actor, 'followers', RAW_CAP),
  ]);
  const followerDids = new Set(followers.map((p) => p.did));
  return follows.filter((p) => followerDids.has(p.did));
}

/** Raw followers list — paginated, uncapped beyond RAW_CAP. */
async function fetchFollowersRaw(actor: string): Promise<MiniProfile[]> {
  return paginateGraph('app.bsky.graph.getFollowers', actor, 'followers', RAW_CAP);
}

/**
 * Top likers — people whose names keep showing up on this account's likes.
 *
 * Constellation indexes backlinks by exact target, so we can't ask for
 * "every like received by a DID" in one call — like records point at post
 * URIs, not at a user's DID. We fan out instead: fetch N recent posts via
 * the AppView, then hit constellation once per post (in parallel) for the
 * first page of likers. Aggregate + rank.
 *
 * We only look at the first 100 likers per post. For a viral post that's a
 * sample, not the full list, but it's enough to surface repeat likers —
 * which is the only thing that matters for this ranking. The alternative
 * (paginating every like on every post) would be thousands of calls on a
 * busy account.
 */
async function fetchTopLikers(
  actor: string,
  onProgress?: (done: number, total: number) => void,
): Promise<Array<Profile & { likeCount: number }>> {
  const CONSTELLATION = 'https://constellation.microcosm.blue';
  const POST_SAMPLE = 40; // most-recent posts to sample
  const feed = await rpc.get('app.bsky.feed.getAuthorFeed', {
    params: { actor, limit: POST_SAMPLE, filter: 'posts_and_author_threads' },
  });
  const posts = (feed.data as unknown as { feed: Array<{ post: { uri: string; author: { did: string } } }> }).feed;
  const postUris = posts.map((p) => p.post.uri);
  const selfDid = posts[0]?.post.author.did;

  const counts = new Map<string, number>();
  let done = 0;
  await Promise.all(
    postUris.map(async (uri) => {
      try {
        const url = new URL(`${CONSTELLATION}/xrpc/blue.microcosm.links.getBacklinks`);
        url.searchParams.set('subject', uri);
        url.searchParams.set('source', 'app.bsky.feed.like:subject.uri');
        url.searchParams.set('limit', '100');
        const r = await fetch(url.toString());
        if (!r.ok) return;
        const j = (await r.json()) as { records?: Array<{ did: string }> };
        for (const rec of j.records ?? []) {
          counts.set(rec.did, (counts.get(rec.did) ?? 0) + 1);
        }
      } catch {
        /* tolerate individual post failures — partial results are still useful */
      } finally {
        done++;
        onProgress?.(done, postUris.length);
      }
    }),
  );

  // drop self-likes — otherwise big accounts often rank themselves #1.
  if (selfDid) counts.delete(selfDid);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIKERS_CAP);
  const enriched = await enrichProfiles(top.map(([d]) => d));
  const byDid = new Map(enriched.map((p) => [p.did, p]));
  return top
    .map(([d, c]) => {
      const p = byDid.get(d);
      return p ? { ...p, likeCount: c } : null;
    })
    .filter((p): p is Profile & { likeCount: number } => !!p);
}

type CollectionState = {
  cards: Profile[];
  status: 'idle' | 'fetching' | 'enriching' | 'done' | 'error';
  enriched: number;
  total: number;
};

const EMPTY_COLLECTION: CollectionState = { cards: [], status: 'idle', enriched: 0, total: 0 };

/**
 * Progressive-enrichment hook: paginate every follower/moot, render them
 * immediately as placeholder cards, then stream enriched profiles into
 * place in batches so rarity/HP/archetype fill in after the first render.
 *
 * Why not just `useQuery`: react-query returns a single final value. We
 * want the card grid to render on the first pagination result and then
 * keep upgrading — that's an incremental stream, which is cleaner as
 * local state + an effect.
 */
function useCollection(
  actor: string | undefined,
  fetchRaw: (actor: string) => Promise<MiniProfile[]>,
): CollectionState {
  const [state, setState] = useState<CollectionState>(EMPTY_COLLECTION);

  useEffect(() => {
    if (!actor) {
      setState(EMPTY_COLLECTION);
      return;
    }
    let cancelled = false;
    (async () => {
      setState({ cards: [], status: 'fetching', enriched: 0, total: 0 });
      let raw: MiniProfile[];
      try {
        raw = await fetchRaw(actor);
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: 'error' }));
        return;
      }
      if (cancelled) return;

      // show everything right away as minimal cards. they render as common
      // until their batch enriches them.
      const initialCards: Profile[] = raw.map((m) => ({ ...m }));
      setState({ cards: initialCards, status: 'enriching', enriched: 0, total: raw.length });

      // chunk the enrichment — 25 per getProfiles call, 4 batches in flight
      // at once. that's ~100 concurrent API calls max worst-case, but the
      // browser caps at 6 per origin so it naturally paces itself.
      const CONCURRENCY = 4;
      const batches: string[][] = [];
      for (let i = 0; i < raw.length; i += 25) batches.push(raw.slice(i, i + 25).map((m) => m.did));

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        if (cancelled) return;
        const slice = batches.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map(async (dids) => {
            try {
              const r = await rpc.get('app.bsky.actor.getProfiles', { params: { actors: dids } });
              return (r.data as unknown as { profiles: Profile[] }).profiles;
            } catch {
              return [] as Profile[];
            }
          }),
        );
        if (cancelled) return;
        const flat = results.flat();
        const doneNow = Math.min((i + CONCURRENCY) * 25, raw.length);
        setState((s) => {
          const byDid = new Map(flat.map((p) => [p.did, p]));
          const next = s.cards.map((c) => byDid.get(c.did) ?? c);
          return { ...s, cards: next, enriched: doneNow };
        });
      }
      if (cancelled) return;
      // one final sort at the end — doing it inside the enrichment loop
      // would reshuffle the grid every batch, which looks janky.
      setState((s) => ({
        ...s,
        cards: [...s.cards].sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0)),
        status: 'done',
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [actor, fetchRaw]);

  return state;
}

async function paginateGraph(
  nsid: 'app.bsky.graph.getFollows' | 'app.bsky.graph.getFollowers',
  actor: string,
  field: 'follows' | 'followers',
  cap: number,
): Promise<MiniProfile[]> {
  const out: MiniProfile[] = [];
  let cursor: string | undefined;
  while (out.length < cap) {
    const r = await rpc.get(nsid, { params: { actor, limit: 100, cursor } });
    const page = ((r.data as unknown as Record<string, unknown>)[field] as MiniProfile[]) ?? [];
    out.push(...page);
    const next = (r.data as unknown as { cursor?: string }).cursor;
    if (!next || page.length === 0) break;
    cursor = next;
  }
  return out.slice(0, cap);
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatCount(n?: number): string {
  if (n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

type Tab = 'moots' | 'followers' | 'likers';

export default function BskyCardsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { handle?: string };
  const [input, setInput] = useState(search.handle ?? 'imlunahey.com');
  const [tab, setTab] = useState<Tab>('moots');
  const [likersProgress, setLikersProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const profileQuery = useQuery({
    queryKey: ['bsky-card', search.handle],
    queryFn: () => fetchProfile(search.handle!),
    enabled: !!search.handle,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const profile = profileQuery.data;

  // reset progress + tab when the subject of the binder changes.
  useEffect(() => {
    setLikersProgress({ done: 0, total: 0 });
    setTab('moots');
  }, [search.handle]);

  // all three collections load in parallel as soon as we have a profile.
  // moots + followers use a custom progressive-enrichment hook so cards
  // render immediately and rarity fills in as getProfiles batches return.
  // likers still uses react-query because it's a single-shot scan with
  // well-defined start/end.
  const moots = useCollection(profile ? search.handle : undefined, fetchMootsRaw);
  const followers = useCollection(profile ? search.handle : undefined, fetchFollowersRaw);

  const likersQuery = useQuery({
    queryKey: ['bsky-likers', profile?.did],
    queryFn: () => fetchTopLikers(profile!.did, (done, total) => setLikersProgress({ done, total })),
    enabled: !!profile,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = input.trim().replace(/^@/, '');
    if (!h) return;
    navigate({ to: '/labs/bsky-cards' as never, search: { handle: h } as never });
  };

  const loadHandle = useCallback((h: string) => {
    setInput(h);
    navigate({ to: '/labs/bsky-cards' as never, search: { handle: h } as never });
  }, [navigate]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cards">
        <header className="page-hd">
          <div className="label">~/labs/bsky-cards</div>
          <h1>bsky cards<span className="dot">.</span></h1>
          <p className="sub">
            any bluesky account as a holographic trading card. stats come from the public appview;
            top-liker aggregation from constellation&apos;s backlink index. rarity tiers by follower
            bracket, archetype from post cadence + follow ratio, holo foil + mouse-tilt on every
            card.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle — e.g. imlunahey.com"
            aria-label="bluesky handle"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">summon →</button>
        </form>

        {profileQuery.isError ? (
          <div className="err">couldn&apos;t find &quot;{search.handle}&quot; — check the handle.</div>
        ) : null}
        {profileQuery.isLoading ? <div className="loading">loading profile…</div> : null}

        {profile ? (
          <section className="hero-wrap">
            <StatCard profile={profile} size="hero" />
          </section>
        ) : null}

        {profile ? (
          <section className="binder">
            <div className="binder-title">
              <span className="binder-label">/// binder</span>
              <span className="binder-owner">@{profile.handle}</span>
            </div>
            <div className="binder-hd">
              <div className="tabs" role="tablist" aria-label="card collections">
                <TabButton active={tab === 'moots'} onClick={() => setTab('moots')} count={moots.cards.length || undefined}>
                  moots
                </TabButton>
                <TabButton active={tab === 'followers'} onClick={() => setTab('followers')} count={followers.cards.length || undefined}>
                  followers
                </TabButton>
                <TabButton active={tab === 'likers'} onClick={() => setTab('likers')} count={likersQuery.data?.length}>
                  top likers
                </TabButton>
              </div>
              <div className="tab-status">
                {tab === 'moots' ? (
                  moots.status === 'fetching' ? <span className="t-faint">scanning follows ∩ followers…</span>
                  : moots.status === 'enriching' ? <span className="t-faint">upgrading · {moots.enriched}/{moots.total}</span>
                  : moots.status === 'done' ? <span className="t-accent">{moots.cards.length} cards</span>
                  : null
                ) : tab === 'followers' ? (
                  followers.status === 'fetching' ? <span className="t-faint">scanning followers…</span>
                  : followers.status === 'enriching' ? <span className="t-faint">upgrading · {followers.enriched}/{followers.total}</span>
                  : followers.status === 'done' ? <span className="t-accent">{followers.cards.length} cards</span>
                  : null
                ) : (
                  likersQuery.isLoading ? (
                    <span className="t-faint">
                      scanning likes{likersProgress.total > 0 ? ` · ${likersProgress.done}/${likersProgress.total} posts` : '…'}
                    </span>
                  )
                  : likersQuery.data ? <span className="t-accent">{likersQuery.data.length} cards</span>
                  : null
                )}
              </div>
            </div>

            <p className="binder-sub">
              {tab === 'moots'
                ? 'people who follow you and who you follow back. sorted by rarity — legendaries first.'
                : tab === 'followers'
                ? 'everyone following this account. capped at the first 120 for now.'
                : 'every account that liked one of this account\'s posts, ranked by like count. via constellation.microcosm.blue.'}
              {' '}
              <span className="t-accent">click any card to summon them as the hero.</span>
            </p>

            {tab === 'moots' && moots.status === 'error' ? (
              <div className="err">moots scan failed — the appview is rate-limiting or offline.</div>
            ) : null}
            {tab === 'followers' && followers.status === 'error' ? (
              <div className="err">followers scan failed.</div>
            ) : null}
            {tab === 'likers' && likersQuery.isError ? (
              <div className="err">likers scan failed — constellation is offline or rate-limiting. try again in a minute.</div>
            ) : null}

            <CardGrid
              cards={
                tab === 'moots' ? moots.cards
                : tab === 'followers' ? followers.cards
                : likersQuery.data
              }
              loading={
                tab === 'moots' ? moots.status === 'fetching'
                : tab === 'followers' ? followers.status === 'fetching'
                : likersQuery.isLoading
              }
              emptyLabel={
                tab === 'moots' ? 'no moots — one-way follows only.'
                : tab === 'followers' ? 'no followers yet.'
                : 'no likers indexed yet. constellation backfill is limited to recent history.'
              }
              onOpen={loadHandle}
              renderBadge={tab === 'likers' ? (c) => {
                const like = (c as Profile & { likeCount?: number }).likeCount;
                return like !== undefined ? `×${like}` : null;
              } : undefined}
            />
          </section>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">public.api.bsky.app · constellation.microcosm.blue</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`tab ${active ? 'on' : ''}`}
      onClick={onClick}
    >
      <span className="tab-label">{children}</span>
      <span className="tab-count">{count ?? '—'}</span>
    </button>
  );
}

function CardGrid({
  cards,
  loading,
  emptyLabel,
  onOpen,
  renderBadge,
}: {
  cards: Profile[] | undefined;
  loading: boolean;
  emptyLabel: string;
  onOpen: (handle: string) => void;
  renderBadge?: (c: Profile) => string | null;
}) {
  if (loading && !cards) {
    return (
      <div className="binder-loading">
        <div className="spinner" aria-hidden="true" />
        <span>enriching profiles — this may take a few seconds</span>
      </div>
    );
  }
  if (!cards) return null;
  if (cards.length === 0) return <div className="binder-empty">{emptyLabel}</div>;
  return (
    <div className="binder-grid">
      {cards.map((c) => (
        <MiniCard
          key={c.did}
          profile={c}
          badge={renderBadge?.(c) ?? null}
          onOpen={() => onOpen(c.handle)}
        />
      ))}
    </div>
  );
}

// ─── card renderer ─────────────────────────────────────────────────────────

function StatCard({ profile, size }: { profile: Profile; size: 'hero' | 'mini' }) {
  const ref = useRef<HTMLDivElement>(null);
  const rarity = rarityFor(profile.followersCount ?? 0);
  const archetype = archetypeFor(profile);
  const age = ageInDays(profile.createdAt);
  const ppd = age > 0 ? ((profile.postsCount ?? 0) / age).toFixed(1) : '0';

  // set CSS vars from mouse position so the tilt + holo shine track the
  // cursor. bail early on reduced-motion, and also on mini cards — the
  // binder-grid's perspective + preserve-3d chain was interacting with the
  // per-card getBoundingClientRect in a feedback loop that wildly skewed
  // minis on hover. hero card alone keeps the tilt.
  const tiltEnabled = size === 'hero';
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltEnabled) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1 (left → right)
    const y = (e.clientY - rect.top) / rect.height; // 0..1 (top → bottom)
    // invert Y so pointing up tilts the card back, not forward.
    const rx = (0.5 - y) * 14;
    const ry = (x - 0.5) * 14;
    el.style.setProperty('--rx', `${rx}deg`);
    el.style.setProperty('--ry', `${ry}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--active', '1');
  }, [tiltEnabled]);

  const onLeave = useCallback(() => {
    if (!tiltEnabled) return;
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--active', '0');
  }, [tiltEnabled]);

  return (
    <div
      ref={ref}
      className={`card card-${size} r-${rarity}`}
      onMouseMove={tiltEnabled ? onMove : undefined}
      onMouseLeave={tiltEnabled ? onLeave : undefined}
      aria-label={`${profile.handle} — ${rarity} ${archetype.label}`}
    >
      <div className="card-inner">
        <div className="card-foil" aria-hidden="true" />
        <div className="card-shine" aria-hidden="true" />
        <div className="card-frame">
          <div className="card-head">
            <div className="card-name">
              <div className="card-display">{profile.displayName || profile.handle}</div>
              <div className="card-handle">@{profile.handle}</div>
            </div>
            <div className="card-hp">
              <span className="hp-label">HP</span>
              <span className="hp-val">{formatCount(profile.followersCount)}</span>
            </div>
          </div>

          <div className="card-portrait">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" loading="lazy" />
            ) : (
              <div className="portrait-fallback">{(profile.handle?.[0] ?? '?').toUpperCase()}</div>
            )}
            <div className="portrait-rarity">{rarity}</div>
          </div>

          <div className="card-type">
            <span className="type-glyph" aria-hidden="true">{archetype.glyph}</span>
            <span className="type-label">{archetype.label}</span>
            {size === 'hero' ? <span className="type-desc">— {archetype.description}</span> : null}
          </div>

          {size === 'hero' && profile.description ? (
            <div className="card-flavor">
              {profile.description.trim().slice(0, 180)}
              {profile.description.length > 180 ? '…' : ''}
            </div>
          ) : null}

          <div className="card-stats">
            <StatRow label="posts" value={formatCount(profile.postsCount)} />
            <StatRow label="following" value={formatCount(profile.followsCount)} />
            {size === 'hero' ? <StatRow label="posts / day" value={ppd} /> : null}
            {size === 'hero' ? <StatRow label="account age" value={age > 0 ? `${age} days` : '—'} /> : null}
          </div>

          <div className="card-foot">
            <span className="foot-slug">
              {size === 'hero' ? formatDate(profile.createdAt) : rarity}
            </span>
            <span className="foot-glyph" aria-hidden="true">◈</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <span className="stat-k">{label}</span>
      <span className="stat-v">{value}</span>
    </div>
  );
}

function MiniCard({ profile, badge, onOpen }: { profile: Profile; badge?: string | null; onOpen: () => void }) {
  return (
    <button type="button" className="mini-btn" onClick={onOpen} aria-label={`summon ${profile.handle}`}>
      <StatCard profile={profile} size="mini" />
      {badge ? <span className="mini-badge" aria-hidden="true">{badge}</span> : null}
      <span className="mini-affordance" aria-hidden="true">summon →</span>
    </button>
  );
}

const CSS = `
  .shell-cards { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }

  .hero-wrap {
    display: flex; justify-content: center;
    padding: var(--sp-8) 0;
    /* perspective on an ancestor so each card's tilt is perspective-correct. */
    perspective: 1400px;
  }

  /* ─── card base ─────────────────────────────────────────────────────── */
  .card {
    --rx: 0deg;
    --ry: 0deg;
    --mx: 50%;
    --my: 50%;
    --active: 0;
    position: relative;
    transform-style: preserve-3d;
    transform: rotateX(var(--rx)) rotateY(var(--ry));
    transition: transform 0.12s ease-out;
    cursor: default;
  }
  .card-hero {
    width: 340px;
    aspect-ratio: 5 / 7;
  }
  .card-mini {
    width: 100%;
    aspect-ratio: 5 / 7;
  }
  .card-inner {
    position: absolute; inset: 0;
    border-radius: 16px;
    overflow: hidden;
    /* rarity-specific border glow set on .r-* */
    box-shadow:
      0 1px 0 rgba(255,255,255,0.08) inset,
      0 30px 60px rgba(0,0,0,0.7),
      0 0 0 1px var(--rare-edge, rgba(255,255,255,0.1));
  }
  .card-frame {
    position: absolute; inset: 0;
    /* flex over grid: grid's minmax(0, 1fr) flavor track was smaller than
       the text block, so stats rendered on top of the overflow. flex lets
       head/type/flavor/stats/foot stay content-sized and portrait absorb
       the slack. */
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px 12px;
    font-family: var(--font-mono);
    color: var(--color-fg);
    background: var(--rare-bg, #0c0c0c);
  }
  .card-frame > * { flex: 0 0 auto; min-height: 0; }
  .card-frame > .card-portrait { flex: 1 1 auto; min-height: 80px; }

  /* ─── foil layer (conic-gradient that tracks tilt) ──────────────────── */
  /* screen blend instead of color-dodge — dodge zeroes out on a near-black
     card frame, so the rainbow never appeared. screen on black passes the
     colour through directly, which is exactly the holo look we want. */
  .card-foil {
    position: absolute; inset: 0;
    pointer-events: none;
    opacity: 0;
    mix-blend-mode: screen;
    background:
      conic-gradient(
        from calc(var(--ry) * 6 + 180deg) at var(--mx) var(--my),
        hsl(0   95% 62%),
        hsl(42  95% 62%),
        hsl(96  85% 58%),
        hsl(180 90% 58%),
        hsl(230 90% 65%),
        hsl(300 85% 62%),
        hsl(0   95% 62%)
      );
    transition: opacity 0.2s ease-out;
  }

  /* ─── shine layer (radial highlight at mouse pos) ───────────────────── */
  .card-shine {
    position: absolute; inset: 0;
    pointer-events: none;
    background: radial-gradient(
      circle at var(--mx) var(--my),
      rgba(255, 255, 255, 0.45),
      rgba(255, 255, 255, 0.15) 22%,
      transparent 55%
    );
    mix-blend-mode: overlay;
    opacity: calc(0.4 + var(--active) * 0.6);
    transition: opacity 0.2s ease-out;
  }

  /* ─── rarity palettes ───────────────────────────────────────────────── */
  .r-common    { --rare-edge: #555; --rare-bg: linear-gradient(180deg, #151515, #0a0a0a); }
  .r-uncommon  { --rare-edge: #4a7a4a; --rare-bg: linear-gradient(180deg, #0f1a10, #060a07); }
  .r-rare      { --rare-edge: #5a8dbf; --rare-bg: linear-gradient(180deg, #0e1620, #050810); }
  .r-epic      { --rare-edge: #9a6bd0; --rare-bg: linear-gradient(180deg, #181022, #0a050f); }
  .r-legendary { --rare-edge: #d4a84a; --rare-bg: linear-gradient(180deg, #1d1608, #0a0704); }

  /* every tier gets *some* holo — scales up with rarity. values are the
     opacity of the screen-blended conic rainbow. */
  .r-common .card-foil    { opacity: calc(0.12 + var(--active) * 0.18); }
  .r-uncommon .card-foil  { opacity: calc(0.2  + var(--active) * 0.22); }
  .r-rare .card-foil      { opacity: calc(0.32 + var(--active) * 0.28); }
  .r-epic .card-foil      { opacity: calc(0.45 + var(--active) * 0.28); }
  .r-legendary .card-foil { opacity: calc(0.6  + var(--active) * 0.3);  }
  .r-legendary .card-inner {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.15) inset,
      0 30px 60px rgba(0,0,0,0.7),
      0 0 0 1px var(--rare-edge),
      0 0 24px color-mix(in oklch, var(--rare-edge) 35%, transparent);
  }

  /* ─── head ──────────────────────────────────────────────────────────── */
  .card-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 8px;
  }
  .card-display {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 220px;
  }
  .card-handle {
    font-size: 10px;
    color: var(--color-fg-faint);
    letter-spacing: 0.04em;
    margin-top: 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 220px;
  }
  .card-hp {
    display: flex; align-items: baseline; gap: 4px;
    font-family: var(--font-display);
    color: var(--rare-edge);
    text-shadow: 0 0 10px color-mix(in oklch, var(--rare-edge) 40%, transparent);
  }
  .hp-label {
    font-size: 9px;
    letter-spacing: 0.2em;
    color: var(--color-fg-faint);
  }
  .hp-val {
    font-size: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  /* ─── portrait ──────────────────────────────────────────────────────── */
  .card-portrait {
    position: relative;
    /* no aspect-ratio — height comes from the grid row, width fills the
       content column. we object-fit the image so avatars crop cleanly. */
    min-height: 0;
    border: 1px solid var(--rare-edge);
    background: #000;
    overflow: hidden;
  }
  .card-portrait img {
    width: 100%; height: 100%; object-fit: cover;
    display: block;
  }
  .portrait-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: 64px;
    color: var(--rare-edge);
    background: var(--color-bg-panel);
  }
  .portrait-rarity {
    position: absolute; bottom: 4px; right: 4px;
    padding: 2px 6px;
    background: rgba(0,0,0,0.6);
    color: var(--rare-edge);
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    border: 1px solid var(--rare-edge);
  }

  /* ─── type + flavor + stats ─────────────────────────────────────────── */
  .card-type {
    display: flex; align-items: baseline; gap: 6px;
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    background: rgba(0,0,0,0.35);
    font-size: 10px;
    color: var(--color-fg-dim);
    letter-spacing: 0.04em;
  }
  .type-glyph { color: var(--rare-edge); font-size: 14px; }
  .type-label { color: var(--color-fg); text-transform: lowercase; }
  .type-desc { color: var(--color-fg-faint); font-size: 9px; }

  .card-flavor {
    padding: 8px 10px;
    border: 1px dashed var(--color-border);
    background: rgba(0,0,0,0.3);
    font-size: 10.5px;
    line-height: 1.5;
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-style: italic;
    /* cap flavor at 3 lines so it can't shove the stats off the card. */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-stats {
    display: flex; flex-direction: column; gap: 2px;
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    background: rgba(0,0,0,0.35);
  }
  .stat-row { display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 0.02em; }
  .stat-k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat-v { color: var(--color-fg); font-variant-numeric: tabular-nums; }

  .card-foot {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9px;
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .foot-glyph { color: var(--rare-edge); font-size: 12px; }

  /* ─── mini tweaks ───────────────────────────────────────────────────── */
  .card-mini .card-frame { padding: 8px 10px; gap: 4px; }
  .card-mini .card-display { font-size: 12px; max-width: 100%; }
  .card-mini .card-handle { font-size: 8px; max-width: 100%; }
  .card-mini .hp-val { font-size: 13px; }
  .card-mini .hp-label { font-size: 7px; }
  .card-mini .portrait-rarity { display: none; }
  .card-mini .card-type { padding: 3px 6px; font-size: 8px; }
  .card-mini .type-glyph { font-size: 10px; }
  .card-mini .stat-row { font-size: 8px; }
  .card-mini .card-stats { padding: 3px 6px; }
  .card-mini .card-foot { font-size: 7px; }

  /* ─── binder (tabs + grid) ──────────────────────────────────────────── */
  .binder {
    position: relative;
    margin-top: var(--sp-8);
    padding: var(--sp-6) var(--sp-5) var(--sp-5);
    border: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--color-bg-panel) 60%, transparent);
  }
  /* corner brackets — same treatment as ConfirmDialog + other "framed"
     surfaces across the site. signals "this is its own surface." */
  .binder::before, .binder::after {
    content: "";
    position: absolute;
    width: 14px; height: 14px;
    pointer-events: none;
  }
  .binder::before {
    top: -1px; left: -1px;
    border-left: 1px solid var(--color-accent);
    border-top: 1px solid var(--color-accent);
  }
  .binder::after {
    bottom: -1px; right: -1px;
    border-right: 1px solid var(--color-accent);
    border-bottom: 1px solid var(--color-accent);
  }

  .binder-title {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: var(--sp-4);
    font-family: var(--font-mono);
  }
  .binder-label {
    color: var(--color-accent);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-shadow: 0 0 6px var(--accent-glow);
  }
  .binder-owner {
    color: var(--color-fg-faint);
    font-size: var(--fs-xs);
  }

  .binder-hd {
    display: flex; justify-content: space-between; align-items: center;
    gap: var(--sp-3); flex-wrap: wrap;
  }
  .binder-hd .t-faint { color: var(--color-fg-faint); font-size: 11px; font-family: var(--font-mono); }
  .binder-hd .t-accent { color: var(--color-accent); font-size: 11px; font-family: var(--font-mono); }
  .binder-sub { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 8px; }

  .tabs {
    display: inline-flex;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg);
  }
  .tab {
    display: inline-flex; flex-direction: column; align-items: flex-start;
    gap: 2px;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--color-fg-dim);
    padding: 8px 18px;
    font-family: var(--font-mono); font-size: var(--fs-sm);
    text-transform: lowercase; letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
    min-width: 110px;
  }
  .tab + .tab { border-left: 1px solid var(--color-border); }
  .tab:hover { color: var(--color-fg); background: color-mix(in oklch, var(--color-accent) 4%, transparent); }
  .tab.on {
    color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 10%, transparent);
    border-bottom-color: var(--color-accent);
    text-shadow: 0 0 6px var(--accent-glow);
  }
  .tab-label { font-size: 13px; }
  .tab-count {
    font-size: 10px;
    color: var(--color-fg-faint);
    letter-spacing: 0.12em;
    font-variant-numeric: tabular-nums;
  }
  .tab.on .tab-count { color: var(--color-accent); }

  .tab-status { font-family: var(--font-mono); font-size: 11px; }
  .scan-btn {
    background: var(--color-accent);
    color: var(--color-bg);
    border: 0;
    padding: 4px 12px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    cursor: pointer; font-weight: 500;
  }
  .scan-btn:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .binder-loading {
    margin-top: var(--sp-5); padding: var(--sp-5);
    display: flex; align-items: center; justify-content: center;
    gap: var(--sp-3);
    border: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .spinner {
    width: 12px; height: 12px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }

  .binder-empty { margin-top: var(--sp-4); padding: var(--sp-4); text-align: center; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-sm); border: 1px dashed var(--color-border); }

  .binder-grid {
    margin-top: var(--sp-4);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--sp-3);
    perspective: 1200px;
  }
  .mini-btn {
    all: unset;
    position: relative;
    display: block;
    cursor: pointer;
    aspect-ratio: 5 / 7;
    /* the grid has perspective — preserve-3d here so the card's rotateX/Y
       actually rotate in 3D space instead of rendering flat. */
    transform-style: preserve-3d;
    transition: filter 0.15s ease-out;
  }
  /* hover uses box-shadow on the inner element rather than filter: on the
     button. filter creates a CSS isolation group which breaks the foil /
     shine layers' mix-blend-mode — they stop blending with the frame's
     backdrop and the card collapses to its (near-black) base colour.
     box-shadow on card-inner gives the same glow without the isolation. */
  .mini-btn:hover { z-index: 2; }
  .mini-btn:hover .card-inner {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.12) inset,
      0 18px 40px rgba(0,0,0,0.7),
      0 0 0 1px var(--rare-edge, rgba(255,255,255,0.15)),
      0 0 24px color-mix(in oklch, var(--color-accent) 35%, transparent);
  }
  .mini-btn .card-inner { transition: box-shadow 0.15s ease-out; }
  .mini-btn:focus-visible { outline: 1px solid var(--color-accent); outline-offset: 4px; }

  .mini-badge {
    position: absolute; top: 4px; right: 4px;
    padding: 2px 6px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-family: var(--font-mono); font-size: 10px;
    font-weight: 500;
    z-index: 3;
    pointer-events: none;
  }

  /* "summon →" pill that reveals on hover/focus — the cards themselves
     have enough going on visually that a static "click me" indicator would
     fight with the holo. fading it in on hover is the lightest possible
     affordance while still being discoverable. */
  .mini-affordance {
    position: absolute;
    bottom: 8px; left: 50%;
    transform: translate(-50%, 4px);
    padding: 3px 10px;
    background: var(--color-accent);
    color: var(--color-bg);
    font-family: var(--font-mono); font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: lowercase;
    opacity: 0;
    z-index: 3;
    pointer-events: none;
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
    box-shadow: 0 0 12px color-mix(in oklch, var(--color-accent) 50%, transparent);
  }
  .mini-btn:hover .mini-affordance,
  .mini-btn:focus-visible .mini-affordance {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  @media (prefers-reduced-motion: reduce) {
    .mini-btn { transition: none; }
    .mini-affordance { transition: none; transform: translate(-50%, 0); }
  }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-6); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }

  @media (prefers-reduced-motion: reduce) {
    .card { transition: none; transform: none; }
    .card-foil { animation: none; }
  }
`;
