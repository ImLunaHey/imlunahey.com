import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  bskyPostWebUrl,
  fetchBacklinks,
  fetchPosts,
  tidToDate,
  type PostView,
} from '../../lib/atproto-helpers';

type Bucket = { when: Date; likes: number; reposts: number; quotes: number; replies: number };

const SOURCES = {
  likes: 'app.bsky.feed.like:subject.uri',
  reposts: 'app.bsky.feed.repost:subject.uri',
  quotes: 'app.bsky.feed.post:embed.record.uri',
  replies: 'app.bsky.feed.post:reply.parent.uri',
} as const;
type Kind = keyof typeof SOURCES;

const COLORS: Record<Kind, string> = {
  likes: 'oklch(0.78 0.16 350)',    // pink
  reposts: 'oklch(0.78 0.15 145)',  // green
  quotes: 'oklch(0.78 0.17 80)',    // amber
  replies: 'oklch(0.75 0.12 240)',  // blue
};

function normaliseSubject(raw: string): string | null {
  const s = raw.trim();
  if (s.startsWith('at://')) return s;
  // bluesky web url → at-uri
  const m = /^https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(s);
  if (m) {
    const authority = m[1];
    const rkey = m[2];
    // if authority is a handle, we'd need resolve — but constellation
    // indexes by at-uri keyed on the did form. punt: accept at-uris here.
    // for a full handle-accepting path, resolveToDid can be wired in.
    if (authority.startsWith('did:')) return `at://${authority}/app.bsky.feed.post/${rkey}`;
  }
  return null;
}

export default function EngagementTimelinePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    navigate({ to: '/labs/engagement-timeline' as never, search: { q } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-et">
        <header className="page-hd">
          <div className="label">~/labs/engagement-timeline</div>
          <h1>engagement timeline<span className="dot">.</span></h1>
          <p className="sub">
            paste a post at-uri (or a <code className="inline">bsky.app/profile/did:.../post/...</code>{' '}
            link) — see when its likes, reposts, quotes, and replies landed over time. buckets are
            derived from each backlink record&apos;s rkey tid, so we don&apos;t have to fetch the
            records themselves.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="at://did:plc:.../app.bsky.feed.post/..."
            aria-label="post at-uri or bsky.app url"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">scan →</button>
        </form>

        {search.q ? <Timeline raw={search.q} /> : (
          <div className="empty">paste a post at-uri above to see its engagement timeline.</div>
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">constellation.microcosm.blue · rkey tid decoding</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Timeline({ raw }: { raw: string }) {
  const subject = useMemo(() => normaliseSubject(raw), [raw]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [post, setPost] = useState<PostView | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [counts, setCounts] = useState<Record<Kind, number>>({ likes: 0, reposts: 0, quotes: 0, replies: 0 });

  useEffect(() => {
    if (!subject) { setState('error'); return; }
    let cancelled = false;
    setState('loading');
    setPost(null);
    setBuckets([]);
    (async () => {
      try {
        // hydrate the post itself (for the header) + all four backlink
        // lists in parallel. fetching the full records is the expensive
        // step if the post has tens of thousands of likes — we cap at
        // 100 per page which is enough to show the shape of the curve
        // without waiting minutes.
        const [posts, likesRes, repostsRes, quotesRes, repliesRes] = await Promise.all([
          fetchPosts([subject]),
          fetchBacklinks(subject, SOURCES.likes, { limit: 100 }),
          fetchBacklinks(subject, SOURCES.reposts, { limit: 100 }),
          fetchBacklinks(subject, SOURCES.quotes, { limit: 100 }),
          fetchBacklinks(subject, SOURCES.replies, { limit: 100 }),
        ]);
        if (cancelled) return;
        setPost(posts.get(subject) ?? null);
        setCounts({
          likes: likesRes.total,
          reposts: repostsRes.total,
          quotes: quotesRes.total,
          replies: repliesRes.total,
        });

        // bucket by ISO date (yyyy-mm-dd). good granularity for most
        // post lifetimes — a single day bucket gets the viral-day spike
        // visible without too many empty days.
        const byDay = new Map<string, Bucket>();
        function add(records: { rkey: string }[], kind: Kind) {
          for (const r of records) {
            const d = tidToDate(r.rkey);
            if (!d) continue;
            const key = d.toISOString().slice(0, 10);
            const b = byDay.get(key) ?? { when: new Date(key + 'T00:00:00Z'), likes: 0, reposts: 0, quotes: 0, replies: 0 };
            b[kind] += 1;
            byDay.set(key, b);
          }
        }
        add(likesRes.records, 'likes');
        add(repostsRes.records, 'reposts');
        add(quotesRes.records, 'quotes');
        add(repliesRes.records, 'replies');
        const sorted = [...byDay.values()].sort((a, b) => a.when.getTime() - b.when.getTime());
        setBuckets(sorted);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [subject]);

  if (!subject) return <div className="err">couldn&apos;t parse that as a post at-uri. expected <code>at://did:plc:.../app.bsky.feed.post/...</code>.</div>;
  if (state === 'loading') return <div className="loading">fetching backlinks + decoding tids…</div>;
  if (state === 'error') return <div className="err">constellation or appview query failed.</div>;

  const maxDay = Math.max(...buckets.map((b) => b.likes + b.reposts + b.quotes + b.replies), 1);
  const totalSampled = buckets.reduce((s, b) => s + b.likes + b.reposts + b.quotes + b.replies, 0);
  const allCount = counts.likes + counts.reposts + counts.quotes + counts.replies;

  return (
    <>
      {post ? (
        <a href={bskyPostWebUrl(post)} target="_blank" rel="noopener noreferrer" className="post-card">
          {post.author.avatar ? <img src={post.author.avatar} alt="" className="post-avatar" /> : <div className="post-avatar empty" />}
          <div className="post-body">
            <div className="post-who">
              <b>{post.author.displayName || post.author.handle}</b>
              <span className="t-faint">@{post.author.handle}</span>
              {post.indexedAt ? <span className="t-faint">· {post.indexedAt.slice(0, 10)}</span> : null}
            </div>
            {post.record.text ? <div className="post-text">{post.record.text.length > 260 ? post.record.text.slice(0, 257) + '…' : post.record.text}</div> : null}
          </div>
        </a>
      ) : null}

      <section className="counts">
        {(Object.keys(SOURCES) as Kind[]).map((k) => (
          <div key={k} className="c">
            <span className="c-dot" style={{ background: COLORS[k] }} aria-hidden="true" />
            <span className="c-k">{k}</span>
            <b>{counts[k].toLocaleString()}</b>
          </div>
        ))}
      </section>

      {allCount > totalSampled ? (
        <div className="sample-hint">
          showing the most-recent 100 of each kind · <b>{totalSampled}</b> of <b>{allCount.toLocaleString()}</b> total
          interactions plotted. constellation caps page size at 100 — older spikes may be off-chart.
        </div>
      ) : null}

      {buckets.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>no interactions found for this post.</div>
      ) : (
        <section className="chart" aria-label="daily engagement histogram">
          {buckets.map((b) => {
            const total = b.likes + b.reposts + b.quotes + b.replies;
            const h = (total / maxDay) * 100;
            return (
              <div key={b.when.toISOString()} className="bar" title={`${b.when.toISOString().slice(0, 10)} · ${total} interactions`}>
                <div className="bar-stack" style={{ height: `${h}%` }}>
                  {(['likes', 'reposts', 'quotes', 'replies'] as Kind[]).map((k) => {
                    if (b[k] === 0) return null;
                    const kh = (b[k] / total) * 100;
                    return <div key={k} className="bar-seg" style={{ height: `${kh}%`, background: COLORS[k] }} />;
                  })}
                </div>
                <div className="bar-label">{b.when.toISOString().slice(5, 10)}</div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

const CSS = `
  .shell-et { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .empty, .loading, .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; }
  .empty { border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; }
  .loading { border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .err { border: 1px solid var(--color-alert); color: var(--color-alert); }
  .err code { background: var(--color-bg-raised); padding: 1px 5px; }

  .post-card { display: grid; grid-template-columns: 40px 1fr; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); text-decoration: none; color: inherit; transition: background 0.1s; }
  .post-card:hover { text-decoration: none; background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel)); }
  .post-avatar { width: 40px; height: 40px; border: 1px solid var(--color-border); object-fit: cover; }
  .post-avatar.empty { background: var(--color-bg-raised); background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .post-who { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .post-who b { color: var(--color-fg); font-weight: 400; }
  .post-who .t-faint { color: var(--color-fg-faint); }
  .post-text { color: var(--color-fg-dim); font-size: var(--fs-xs); line-height: 1.55; margin-top: 4px; white-space: pre-wrap; overflow-wrap: break-word; }

  .counts { display: flex; gap: var(--sp-4); flex-wrap: wrap; margin-top: var(--sp-4); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .c { display: inline-flex; align-items: center; gap: 6px; }
  .c-dot { display: inline-block; width: 8px; height: 8px; }
  .c-k { color: var(--color-fg-faint); }
  .c b { color: var(--color-fg); font-weight: 400; font-variant-numeric: tabular-nums; }

  .sample-hint { margin-top: var(--sp-3); font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); padding: 6px 10px; border: 1px dashed var(--color-border); }
  .sample-hint b { color: var(--color-fg-dim); font-weight: 400; }

  .chart { margin-top: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); display: grid; grid-auto-columns: minmax(18px, 1fr); grid-auto-flow: column; gap: 3px; align-items: end; height: 280px; overflow-x: auto; }
  .bar { display: flex; flex-direction: column; gap: 4px; height: 100%; justify-content: flex-end; }
  .bar-stack { display: flex; flex-direction: column-reverse; width: 100%; min-height: 2px; }
  .bar-seg { width: 100%; }
  .bar-label { font-family: var(--font-mono); font-size: 9px; color: var(--color-fg-faint); text-align: center; letter-spacing: -0.02em; writing-mode: horizontal-tb; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
