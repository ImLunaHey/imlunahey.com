import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  bskyPostWebUrl,
  fetchAuthorFeed,
  fetchBacklinksCount,
  fetchProfile,
  type PostView,
  type ProfileView,
} from '../../lib/atproto-helpers';

// Default weights — tunable from the UI so users can lean the ranking
// toward "wide reach" (reposts/quotes) vs "raw popularity" (likes) vs
// "conversation" (replies).
const DEFAULT_WEIGHTS = { likes: 1, reposts: 2, quotes: 3, replies: 0.5 };

type Weights = typeof DEFAULT_WEIGHTS;
type RankedPost = PostView & { likes: number; reposts: number; quotes: number; replies: number; score: number };

export default function TopPostsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim().replace(/^@/, '');
    if (!q) return;
    navigate({ to: '/labs/top-posts' as never, search: { q } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tp">
        <header className="page-hd">
          <div className="label">~/labs/top-posts</div>
          <h1>top posts<span className="dot">.</span></h1>
          <p className="sub">
            an account&apos;s greatest hits, ranked across likes, reposts, quotes, and replies. each
            count comes from a single constellation query per post, so this is cheap even on
            prolific accounts.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle — e.g. bsky.app"
            aria-label="bluesky handle or did"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">rank →</button>
        </form>

        {search.q ? <Results handle={search.q} /> : <Empty />}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">public.api.bsky.app · constellation.microcosm.blue</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Empty() {
  return (
    <div className="empty">
      try it with a handle you follow — or paste any bluesky handle or did above.
    </div>
  );
}

function Results({ handle }: { handle: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [ranked, setRanked] = useState<RankedPost[]>([]);
  const [err, setErr] = useState('');
  const [weights] = useState<Weights>(DEFAULT_WEIGHTS);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setRanked([]);
    setProfile(null);
    setErr('');
    (async () => {
      try {
        const p = await fetchProfile(handle);
        if (cancelled) return;
        if (!p) { setErr(`couldn't find @${handle}`); setState('error'); return; }
        setProfile(p);

        // pull the last ~100 posts — enough to find viral ones without
        // being too slow. filter to the user's own posts (no reposts in
        // the feed) so we're ranking their actual content.
        const posts = await fetchAuthorFeed(p.did, { limit: 100, filter: 'posts_and_author_threads' });
        if (cancelled) return;
        const own = posts.filter((post) => post.author.did === p.did);

        // 4 parallel count queries per post (likes / reposts / quotes /
        // replies). With ~80 posts that's ~320 lightweight constellation
        // calls. Browsers cap concurrent requests per-origin at ~6, so
        // effectively batched.
        const sources = {
          likes: 'app.bsky.feed.like:subject.uri',
          reposts: 'app.bsky.feed.repost:subject.uri',
          quotes: 'app.bsky.feed.post:embed.record.uri',
          replies: 'app.bsky.feed.post:reply.parent.uri',
        } as const;
        const results = await Promise.all(
          own.map(async (post) => {
            const [likes, reposts, quotes, replies] = await Promise.all([
              fetchBacklinksCount(post.uri, sources.likes),
              fetchBacklinksCount(post.uri, sources.reposts),
              fetchBacklinksCount(post.uri, sources.quotes),
              fetchBacklinksCount(post.uri, sources.replies),
            ]);
            const score =
              likes * weights.likes +
              reposts * weights.reposts +
              quotes * weights.quotes +
              replies * weights.replies;
            return { ...post, likes, reposts, quotes, replies, score };
          }),
        );
        if (cancelled) return;
        results.sort((a, b) => b.score - a.score);
        setRanked(results);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [handle, weights]);

  const stats = useMemo(() => {
    if (ranked.length === 0) return null;
    return {
      posts: ranked.length,
      totalLikes: ranked.reduce((s, p) => s + p.likes, 0),
      totalReposts: ranked.reduce((s, p) => s + p.reposts, 0),
      totalQuotes: ranked.reduce((s, p) => s + p.quotes, 0),
      totalReplies: ranked.reduce((s, p) => s + p.replies, 0),
    };
  }, [ranked]);

  if (state === 'loading') {
    return <div className="loading">fetching feed + counting backlinks…</div>;
  }
  if (state === 'error' || !profile) {
    return <div className="err">{err || 'unknown error'}</div>;
  }

  return (
    <>
      <section className="profile">
        {profile.avatar ? <img src={profile.avatar} alt="" className="profile-avatar" /> : <div className="profile-avatar empty" />}
        <div className="profile-meta">
          <div className="profile-name">{profile.displayName || profile.handle}</div>
          <div className="profile-handle">@{profile.handle}</div>
        </div>
      </section>

      {stats ? (
        <section className="stats">
          <div><span className="k">posts ranked</span><b>{stats.posts}</b></div>
          <div><span className="k">total likes</span><b>{stats.totalLikes.toLocaleString()}</b></div>
          <div><span className="k">total reposts</span><b>{stats.totalReposts.toLocaleString()}</b></div>
          <div><span className="k">total quotes</span><b>{stats.totalQuotes.toLocaleString()}</b></div>
          <div><span className="k">total replies</span><b>{stats.totalReplies.toLocaleString()}</b></div>
        </section>
      ) : null}

      <ol className="ranked">
        {ranked.slice(0, 25).map((p, i) => {
          const text = p.record.text ?? '';
          const snippet = text.length > 260 ? text.slice(0, 257) + '…' : text;
          return (
            <li key={p.uri} className="r-item">
              <a className="r-main" href={bskyPostWebUrl(p)} target="_blank" rel="noopener noreferrer">
                <span className="r-rank">#{i + 1}</span>
                <div className="r-body">
                  {snippet ? <div className="r-text">{snippet}</div> : <div className="r-text t-faint">(no text — embed or quote)</div>}
                  <div className="r-counts">
                    <span>♡ <b>{p.likes.toLocaleString()}</b></span>
                    <span>↻ <b>{p.reposts.toLocaleString()}</b></span>
                    <span>❝ <b>{p.quotes.toLocaleString()}</b></span>
                    <span>↳ <b>{p.replies.toLocaleString()}</b></span>
                    <span className="r-score">score {p.score.toFixed(1)}</span>
                    {p.record.createdAt ? <span className="r-when">· {p.record.createdAt.slice(0, 10)}</span> : null}
                  </div>
                </div>
              </a>
              {/* secondary action: open this post's engagement timeline lab
                  internally. split into its own tanstack Link so we don't
                  nest anchors (invalid html) and keep client-side routing. */}
              <Link
                className="r-timeline"
                to="/labs/engagement-timeline"
                search={{ q: p.uri } as never}
                title="plot likes / reposts / quotes / replies over time"
              >
                <span aria-hidden="true">▆</span> engagement
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

const CSS = `
  .shell-tp { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); line-height: 1.55; }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .empty, .loading, .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; }
  .empty { border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; }
  .loading { border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .err { border: 1px solid var(--color-alert); color: var(--color-alert); }

  .profile { margin-top: var(--sp-5); display: grid; grid-template-columns: 48px 1fr; gap: var(--sp-3); align-items: center; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); }
  .profile-avatar { width: 48px; height: 48px; border: 1px solid var(--color-border-bright); background: var(--color-bg-raised); object-fit: cover; }
  .profile-avatar.empty { background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .profile-name { font-family: var(--font-display); font-size: 20px; color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.1; }
  .profile-handle { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 2px; }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stats .k { color: var(--color-fg-faint); display: block; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .stats b { color: var(--color-fg); font-size: var(--fs-md); font-weight: 400; font-variant-numeric: tabular-nums; }

  .ranked { list-style: none; margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); counter-reset: rank; }
  .r-item { display: flex; align-items: stretch; border-bottom: 1px dashed var(--color-border); }
  .r-item:last-child { border-bottom: 0; }
  .r-main { flex: 1; display: grid; grid-template-columns: 56px 1fr; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); text-decoration: none; color: inherit; transition: background 0.1s ease-out; min-width: 0; }
  .r-main:hover { text-decoration: none; background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  .r-main:hover .r-rank { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  /* separate link → our engagement-timeline lab. keeps the click target
     for the primary "view on bsky" action intact but gives a one-click
     jump into the timeline viz for that post. */
  .r-timeline {
    flex: 0 0 auto;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 0 var(--sp-4);
    border-left: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-decoration: none;
    transition: color 0.1s, background 0.1s;
    white-space: nowrap;
  }
  .r-timeline:hover { text-decoration: none; color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  @media (max-width: 640px) {
    .r-item { flex-direction: column; }
    .r-timeline { border-left: 0; border-top: 1px dashed var(--color-border); padding: 8px var(--sp-4); justify-content: center; }
  }
  .r-rank { font-family: var(--font-display); font-size: 28px; color: var(--color-fg-faint); line-height: 1; }
  .r-body { min-width: 0; }
  .r-text { color: var(--color-fg); font-size: var(--fs-sm); line-height: 1.5; overflow-wrap: break-word; white-space: pre-wrap; }
  .r-text.t-faint { color: var(--color-fg-faint); }
  .r-counts { margin-top: 6px; display: flex; gap: var(--sp-3); flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); font-variant-numeric: tabular-nums; }
  .r-counts b { color: var(--color-fg); font-weight: 400; }
  .r-score { color: var(--color-accent); }
  .r-when { color: var(--color-fg-faint); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
