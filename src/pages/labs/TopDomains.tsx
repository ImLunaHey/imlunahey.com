import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  bskyPostWebUrl,
  fetchAuthorFeed,
  fetchProfile,
  type PostView,
  type ProfileView,
} from '../../lib/atproto-helpers';

type DomainEntry = { domain: string; count: number; examples: PostView[] };

function extractUrls(post: PostView): string[] {
  const out = new Set<string>();
  // facet links
  const text = post.record.text ?? '';
  // regex as a fallback in case facets aren't populated
  const rx = /https?:\/\/[^\s<>)"']+/g;
  for (const m of text.matchAll(rx)) out.add(m[0]);
  // external embed
  const ext = post.record.embed?.external?.uri;
  if (ext) out.add(ext);
  return [...out];
}

function domainOf(url: string): string | null {
  try {
    const u = new URL(url);
    // strip common subdomain noise so "www.example.com" and "example.com"
    // group together. keep everything else (e.g. "blog.example.com"
    // stays separate from "example.com" intentionally).
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const BSKY_DOMAINS = new Set(['bsky.app', 'bsky.social', 'go.bsky.app']);

export default function TopDomainsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim().replace(/^@/, '');
    if (!q) return;
    navigate({ to: '/labs/top-domains' as never, search: { q } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-td">
        <header className="page-hd">
          <div className="label">~/labs/top-domains</div>
          <h1>top domains<span className="dot">.</span></h1>
          <p className="sub">
            paste a handle — what websites do they link to most? scans the last 100 posts for
            external link embeds + inline urls, aggregates by host. excludes bsky&apos;s own
            domains. "what&apos;s this person obsessed with reading" map.
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
          <button type="submit">scan →</button>
        </form>

        {search.q ? <Results handle={search.q} /> : (
          <div className="empty">paste any handle to see their most-linked domains.</div>
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
  const [entries, setEntries] = useState<DomainEntry[]>([]);
  const [scannedPosts, setScannedPosts] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setEntries([]);
    setErr('');
    (async () => {
      try {
        const p = await fetchProfile(handle);
        if (cancelled) return;
        if (!p) { setErr(`couldn't find @${handle}`); setState('error'); return; }
        setProfile(p);

        const posts = await fetchAuthorFeed(p.did, { limit: 100, filter: 'posts_and_author_threads' });
        if (cancelled) return;
        const own = posts.filter((post) => post.author.did === p.did);
        setScannedPosts(own.length);

        const byDomain = new Map<string, DomainEntry>();
        for (const post of own) {
          const urls = extractUrls(post);
          for (const url of urls) {
            const d = domainOf(url);
            if (!d || BSKY_DOMAINS.has(d)) continue;
            const e = byDomain.get(d) ?? { domain: d, count: 0, examples: [] };
            e.count++;
            if (e.examples.length < 3 && !e.examples.some((x) => x.uri === post.uri)) {
              e.examples.push(post);
            }
            byDomain.set(d, e);
          }
        }
        const sorted = [...byDomain.values()].sort((a, b) => b.count - a.count);
        setEntries(sorted);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  if (state === 'loading') return <div className="loading">fetching feed + extracting urls…</div>;
  if (state === 'error' || !profile) return <div className="err">{err || 'unknown error'}</div>;

  const totalLinks = entries.reduce((s, e) => s + e.count, 0);

  return (
    <>
      <section className="profile">
        {profile.avatar ? <img src={profile.avatar} alt="" className="profile-avatar" /> : <div className="profile-avatar empty" />}
        <div className="profile-meta">
          <div className="profile-name">{profile.displayName || profile.handle}</div>
          <div className="profile-handle">@{profile.handle}</div>
        </div>
      </section>

      <section className="stats">
        <div><span className="k">posts scanned</span><b>{scannedPosts}</b></div>
        <div><span className="k">unique domains</span><b>{entries.length}</b></div>
        <div><span className="k">total external links</span><b>{totalLinks}</b></div>
      </section>

      {entries.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>no external links in the last {scannedPosts} posts.</div>
      ) : (
        <ol className="domains">
          {entries.map((e) => {
            const bar = totalLinks > 0 ? (e.count / entries[0].count) * 100 : 0;
            return (
              <li key={e.domain} className="d-item">
                <div className="d-hd">
                  <a className="d-domain" href={`https://${e.domain}`} target="_blank" rel="noopener noreferrer">
                    {e.domain}
                  </a>
                  <span className="d-count"><b>{e.count}</b> link{e.count === 1 ? '' : 's'}</span>
                </div>
                <div className="d-bar"><div className="d-bar-fill" style={{ width: `${bar}%` }} /></div>
                {e.examples.length > 0 ? (
                  <ul className="d-examples">
                    {e.examples.map((post) => {
                      const text = post.record.text ?? '';
                      const snippet = text.length > 120 ? text.slice(0, 117) + '…' : text;
                      return (
                        <li key={post.uri}>
                          <a href={bskyPostWebUrl(post)} target="_blank" rel="noopener noreferrer" className="d-ex-link">
                            {snippet || <span className="t-faint">(link-only post)</span>}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

const CSS = `
  .shell-td { max-width: 880px; margin: 0 auto; padding: 0 var(--sp-6); }
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

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stats .k { color: var(--color-fg-faint); display: block; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .stats b { color: var(--color-fg); font-size: var(--fs-md); font-weight: 400; font-variant-numeric: tabular-nums; }

  .domains { list-style: none; margin-top: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
  .d-item { padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .d-hd { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-3); }
  .d-domain { font-family: var(--font-mono); font-size: var(--fs-md); color: var(--color-accent); text-decoration: none; word-break: break-all; }
  .d-domain:hover { text-decoration: underline; text-underline-offset: 3px; }
  .d-count { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); flex-shrink: 0; }
  .d-count b { color: var(--color-fg); font-weight: 400; font-variant-numeric: tabular-nums; }
  .d-bar { margin-top: 6px; height: 3px; background: var(--color-border); overflow: hidden; }
  .d-bar-fill { height: 100%; background: var(--color-accent); box-shadow: 0 0 6px var(--accent-glow); }
  .d-examples { list-style: none; margin-top: var(--sp-2); padding-left: var(--sp-3); border-left: 1px dashed var(--color-border); display: flex; flex-direction: column; gap: 4px; }
  .d-ex-link { display: block; padding: 4px 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); text-decoration: none; line-height: 1.5; white-space: pre-wrap; overflow-wrap: break-word; transition: background 0.1s, color 0.1s; }
  .d-ex-link:hover { text-decoration: none; color: var(--color-fg); background: color-mix(in oklch, var(--color-accent) 4%, transparent); }
  .d-ex-link .t-faint { color: var(--color-fg-faint); font-style: italic; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
