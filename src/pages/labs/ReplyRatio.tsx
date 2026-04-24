import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  bskyPostWebUrl,
  bskyProfileWebUrl,
  fetchAuthorFeed,
  fetchProfile,
  fetchProfiles,
  type PostView,
  type ProfileView,
} from '../../lib/atproto-helpers';

type Stats = {
  total: number;
  replies: number;
  originals: number;
  replyRatio: number; // 0..1
  topParents: Array<{ did: string; count: number }>;
  avgOriginalLikes: number;
  avgReplyLikes: number;
};

export default function ReplyRatioPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim().replace(/^@/, '');
    if (!q) return;
    navigate({ to: '/labs/reply-ratio' as never, search: { q } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-rr">
        <header className="page-hd">
          <div className="label">~/labs/reply-ratio</div>
          <h1>reply ratio<span className="dot">.</span></h1>
          <p className="sub">
            paste a handle — see how much of their activity is replying to others vs posting
            originals, which accounts they reply to most, and whether their replies out-perform
            their standalone posts. last 100 entries from author feed.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle"
            aria-label="bluesky handle"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">calc →</button>
        </form>

        {search.q ? <Results handle={search.q} /> : (
          <div className="empty">paste any handle to see their reply-vs-original breakdown.</div>
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">public.api.bsky.app · getAuthorFeed</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Results({ handle }: { handle: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [replyExamples, setReplyExamples] = useState<PostView[]>([]);
  const [originalExamples, setOriginalExamples] = useState<PostView[]>([]);
  const [topParentProfiles, setTopParentProfiles] = useState<Map<string, ProfileView>>(new Map());
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setStats(null);
    setErr('');
    (async () => {
      try {
        const p = await fetchProfile(handle);
        if (cancelled) return;
        if (!p) { setErr(`couldn't find @${handle}`); setState('error'); return; }
        setProfile(p);

        // include replies — default filter would exclude them.
        const posts = await fetchAuthorFeed(p.did, { limit: 100, filter: 'posts_with_replies' });
        if (cancelled) return;
        const own = posts.filter((post) => post.author.did === p.did);

        const isReply = (post: PostView): boolean => !!post.record.reply?.parent?.uri;
        const replies = own.filter(isReply);
        const originals = own.filter((p) => !isReply(p));

        // aggregate who they reply to most
        const parentDids = new Map<string, number>();
        for (const r of replies) {
          const parentUri = r.record.reply?.parent?.uri ?? '';
          const parentAuthor = parentUri.match(/^at:\/\/([^/]+)\//)?.[1];
          if (!parentAuthor || parentAuthor === p.did) continue;
          parentDids.set(parentAuthor, (parentDids.get(parentAuthor) ?? 0) + 1);
        }
        const topParents = [...parentDids.entries()]
          .map(([did, count]) => ({ did, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const avgOriginalLikes = originals.length > 0
          ? originals.reduce((s, p) => s + (p.likeCount ?? 0), 0) / originals.length
          : 0;
        const avgReplyLikes = replies.length > 0
          ? replies.reduce((s, p) => s + (p.likeCount ?? 0), 0) / replies.length
          : 0;

        setStats({
          total: own.length,
          replies: replies.length,
          originals: originals.length,
          replyRatio: own.length > 0 ? replies.length / own.length : 0,
          topParents,
          avgOriginalLikes,
          avgReplyLikes,
        });

        // sample examples (top-liked of each kind, up to 3)
        setReplyExamples([...replies].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0)).slice(0, 3));
        setOriginalExamples([...originals].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0)).slice(0, 3));

        // hydrate top-parents profiles
        const parentProfiles = await fetchProfiles(topParents.map((t) => t.did));
        if (cancelled) return;
        setTopParentProfiles(parentProfiles);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  if (state === 'loading') return <div className="loading">fetching the last 100 entries…</div>;
  if (state === 'error' || !profile || !stats) return <div className="err">{err || 'unknown error'}</div>;

  const replyPct = Math.round(stats.replyRatio * 100);
  const replyBias = stats.avgReplyLikes - stats.avgOriginalLikes;

  return (
    <>
      <section className="profile">
        {profile.avatar ? <img src={profile.avatar} alt="" className="profile-avatar" /> : <div className="profile-avatar empty" />}
        <div className="profile-meta">
          <div className="profile-name">{profile.displayName || profile.handle}</div>
          <div className="profile-handle">@{profile.handle}</div>
        </div>
      </section>

      <section className="split">
        <div className="split-bar" role="img" aria-label={`${replyPct}% replies, ${100 - replyPct}% originals`}>
          <div className="split-reply" style={{ width: `${replyPct}%` }} />
          <div className="split-original" style={{ width: `${100 - replyPct}%` }} />
        </div>
        <div className="split-legend">
          <span><i className="dot reply" /> replies · <b>{stats.replies}</b> ({replyPct}%)</span>
          <span><i className="dot original" /> originals · <b>{stats.originals}</b> ({100 - replyPct}%)</span>
        </div>
        <div className="verdict">
          {replyPct >= 70
            ? 'mostly replying — lives in other people\'s threads.'
            : replyPct >= 45
              ? 'balanced — conversation + posting in roughly equal measure.'
              : replyPct >= 20
                ? 'mostly originals — posts more than replies.'
                : 'almost exclusively posts — rarely engages in threads.'}
        </div>
      </section>

      <section className="stats-row">
        <div><span className="k">avg likes · original</span><b>{stats.avgOriginalLikes.toFixed(1)}</b></div>
        <div><span className="k">avg likes · reply</span><b>{stats.avgReplyLikes.toFixed(1)}</b></div>
        <div>
          <span className="k">lean</span>
          <b className={replyBias > 0 ? 't-accent' : replyBias < 0 ? 't-warn' : ''}>
            {replyBias > 0 ? `replies win by ${replyBias.toFixed(1)}` : replyBias < 0 ? `originals win by ${(-replyBias).toFixed(1)}` : 'even'}
          </b>
        </div>
      </section>

      {stats.topParents.length > 0 ? (
        <section className="top-parents">
          <div className="sh">most-replied-to</div>
          <ol className="parents">
            {stats.topParents.map((t) => {
              const p = topParentProfiles.get(t.did);
              return (
                <li key={t.did}>
                  <a className="parent-link" href={p ? bskyProfileWebUrl(p.did) : '#'} target="_blank" rel="noopener noreferrer">
                    {p?.avatar ? <img src={p.avatar} alt="" className="p-avatar" /> : <div className="p-avatar empty" />}
                    <span className="p-name">{p?.displayName || (p ? `@${p.handle}` : t.did)}</span>
                    <span className="p-count">×{t.count}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {(replyExamples.length + originalExamples.length) > 0 ? (
        <section className="examples">
          {originalExamples.length > 0 ? (
            <div className="ex-col">
              <div className="sh">top originals</div>
              <ul className="ex-list">
                {originalExamples.map((p) => <ExampleRow key={p.uri} post={p} />)}
              </ul>
            </div>
          ) : null}
          {replyExamples.length > 0 ? (
            <div className="ex-col">
              <div className="sh">top replies</div>
              <ul className="ex-list">
                {replyExamples.map((p) => <ExampleRow key={p.uri} post={p} />)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function ExampleRow({ post }: { post: PostView }) {
  const text = post.record.text ?? '';
  const snippet = text.length > 160 ? text.slice(0, 157) + '…' : text;
  return (
    <li>
      <a className="ex-link" href={bskyPostWebUrl(post)} target="_blank" rel="noopener noreferrer">
        <div className="ex-text">{snippet || <span className="t-faint">(no text)</span>}</div>
        <div className="ex-counts">♡ {post.likeCount ?? 0} · ↻ {post.repostCount ?? 0} · ↳ {post.replyCount ?? 0}</div>
      </a>
    </li>
  );
}

const CSS = `
  .shell-rr { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }

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

  .split { margin-top: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .split-bar { display: flex; height: 32px; border: 1px solid var(--color-border-bright); overflow: hidden; }
  .split-reply { background: color-mix(in oklch, var(--color-accent) 70%, transparent); }
  .split-original { background: color-mix(in oklch, var(--color-warn) 50%, transparent); }
  .split-legend { display: flex; gap: var(--sp-4); flex-wrap: wrap; margin-top: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .split-legend b { color: var(--color-fg); font-weight: 400; font-variant-numeric: tabular-nums; }
  .dot { display: inline-block; width: 8px; height: 8px; margin-right: 4px; vertical-align: middle; }
  .dot.reply { background: color-mix(in oklch, var(--color-accent) 70%, transparent); }
  .dot.original { background: color-mix(in oklch, var(--color-warn) 50%, transparent); }
  .verdict { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px dashed var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); font-style: italic; }

  .stats-row { margin-top: var(--sp-3); display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stats-row .k { color: var(--color-fg-faint); display: block; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .stats-row b { color: var(--color-fg); font-size: var(--fs-md); font-weight: 400; font-variant-numeric: tabular-nums; }
  .stats-row .t-accent { color: var(--color-accent); }
  .stats-row .t-warn { color: var(--color-warn); }

  .sh { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: var(--sp-2); }
  .top-parents { margin-top: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .parents { list-style: none; display: flex; flex-direction: column; gap: 2px; counter-reset: rank; }
  .parent-link { display: grid; grid-template-columns: 28px 1fr auto; gap: var(--sp-2); align-items: center; padding: 6px 8px; text-decoration: none; color: inherit; border: 1px solid transparent; transition: border 0.1s, background 0.1s; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .parent-link:hover { text-decoration: none; border-color: var(--color-border-bright); background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  .parent-link:hover .p-name { color: var(--color-accent); }
  .p-avatar { width: 28px; height: 28px; border: 1px solid var(--color-border); object-fit: cover; }
  .p-avatar.empty { background: var(--color-bg-raised); background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .p-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p-count { color: var(--color-accent); font-variant-numeric: tabular-nums; }

  .examples { margin-top: var(--sp-4); display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  @media (max-width: 640px) { .examples { grid-template-columns: 1fr; } }
  .ex-col { padding: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .ex-list { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2); }
  .ex-link { display: block; padding: var(--sp-2); border: 1px solid transparent; text-decoration: none; color: inherit; transition: border 0.1s, background 0.1s; }
  .ex-link:hover { text-decoration: none; border-color: var(--color-border-bright); background: color-mix(in oklch, var(--color-accent) 4%, transparent); }
  .ex-text { color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.5; white-space: pre-wrap; overflow-wrap: break-word; }
  .ex-text .t-faint { color: var(--color-fg-faint); font-style: italic; }
  .ex-counts { margin-top: 4px; font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); font-variant-numeric: tabular-nums; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
