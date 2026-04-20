import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { BLOG, BLOG_STATS, type BlogKind, type BlogPost } from '../data';

type Filter = BlogKind | 'all';

export default function BlogPage() {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: BLOG.length, essay: 0, devlog: 0, short: 0 };
    for (const p of BLOG) c[p.kind]++;
    return c;
  }, []);

  const shown = filter === 'all' ? BLOG : BLOG.filter((p) => p.kind === filter);
  const byYear = useMemo(() => groupByYear(shown), [shown]);
  const latest = BLOG[0];

  return (
    <>
      <style>{BLOG_CSS}</style>
      <main className="shell-writing">
        <header className="page-hd">
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              ~/writing
            </div>
            <h1>
              writing<span className="dot">.</span>
            </h1>
            <p className="sub">
              essays, devlogs, and the occasional half-sentence. i write when something hasn't been said the way i'd say
              it. ~one post a month. subscribe to the{' '}
              <a href="#" className="glow-link">
                rss
              </a>
              .
            </p>
          </div>
          <div className="counts">
            <div>
              posts · <b>{BLOG.length}</b>
            </div>
            <div>
              words · <b>{BLOG_STATS.words.toLocaleString()}</b>
            </div>
            <div>
              since · <b>{BLOG_STATS.since}</b>
            </div>
            <div>
              last · <b>{latest?.date ?? '—'}</b>
            </div>
          </div>
        </header>

        <nav className="tabs">
          {(['all', 'essay', 'devlog', 'short'] as const).map((k) => (
            <button
              key={k}
              className={'tab' + (filter === k ? ' on' : '')}
              onClick={() => setFilter(k)}
              type="button"
            >
              {k === 'all' ? 'all' : k + 's'}
              <span className="n">{counts[k]}</span>
            </button>
          ))}
        </nav>

        <div>
          {Object.entries(byYear).map(([year, items]) => (
            <div key={year}>
              <div className="year-head">
                {year} ─ {items.length} {items.length === 1 ? 'post' : 'posts'}
              </div>
              {items.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}` as never} className="post">
                  <span className="date">{p.date}</span>
                  <span className="title">{p.title}</span>
                  <span className="meta">
                    <span className={`kind-chip ${p.kind}`}>{p.kind}</span>
                    <span>{p.readMin}m read</span>
                  </span>
                  <div className="excerpt">// {p.excerpt}</div>
                </Link>
              ))}
            </div>
          ))}
        </div>

        <footer className="writing-footer">
          <span>
            src: <span className="t-accent">lunahey.com/xrpc/com.whtwnd.blog.getEntries</span> · refresh 600s
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function groupByYear(posts: BlogPost[]) {
  const out: Record<string, BlogPost[]> = {};
  for (const p of posts) {
    const y = p.date.slice(0, 4);
    (out[y] ||= []).push(p);
  }
  return out;
}

const BLOG_CSS = `
  .shell-writing { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd {
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--sp-6);
  }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 52ch; margin-top: var(--sp-3); }
  .page-hd .counts { color: var(--color-fg-faint); font-size: var(--fs-xs); text-align: right; line-height: 1.8; }
  .page-hd .counts b { color: var(--color-accent); font-weight: 400; }

  .tabs {
    display: flex;
    gap: 2px;
    padding: var(--sp-5) 0 var(--sp-3);
    font-size: var(--fs-sm);
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
  }
  .tab {
    padding: 6px 14px;
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    background: var(--color-bg-panel);
    cursor: pointer;
    text-transform: lowercase;
    white-space: nowrap;
    transition: all 0.12s;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .tab:hover { border-color: var(--color-border-bright); color: var(--color-fg); }
  .tab.on { border-color: var(--color-accent-dim); color: var(--color-accent); background: var(--color-bg-raised); }
  .tab .n { color: var(--color-fg-faint); margin-left: 6px; font-size: var(--fs-xs); }
  .tab.on .n { color: var(--color-accent-faint); }

  .year-head {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding: var(--sp-8) 0 var(--sp-3);
    letter-spacing: 0.1em;
    display: flex; align-items: center; gap: var(--sp-4);
  }
  .year-head::after {
    content: ""; flex: 1; height: 1px; background: var(--color-border);
  }

  .post {
    display: grid;
    grid-template-columns: 120px 1fr auto;
    gap: var(--sp-5);
    padding: var(--sp-4) 0;
    border-bottom: 1px dashed var(--color-border);
    align-items: baseline;
    cursor: pointer;
    position: relative;
    text-decoration: none;
    color: inherit;
  }
  .post:hover { background: var(--color-bg-raised); text-decoration: none; }
  .post:hover .title { color: var(--color-accent); text-shadow: 0 0 8px var(--accent-glow); }
  .post .date { color: var(--color-fg-faint); font-size: var(--fs-xs); font-family: var(--font-mono); }
  .post .title {
    color: var(--color-fg);
    font-size: var(--fs-lg);
    line-height: 1.3;
    transition: color 0.12s;
  }
  .post .meta {
    display: flex; gap: var(--sp-3);
    align-items: baseline;
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .post .excerpt {
    grid-column: 2 / 3;
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    line-height: 1.5;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease, margin-top 0.25s ease, opacity 0.2s ease;
    opacity: 0;
  }
  .post:hover .excerpt {
    max-height: 60px;
    margin-top: var(--sp-2);
    opacity: 1;
  }
  .kind-chip {
    padding: 1px 7px;
    border: 1px solid var(--color-border-bright);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }
  .kind-chip.essay  { border-color: oklch(0.55 0.13 270); color: oklch(0.8 0.14 270); }
  .kind-chip.devlog { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .kind-chip.short  { border-color: oklch(0.55 0.13 60); color: oklch(0.85 0.14 60); }

  .writing-footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-10);
    padding: var(--sp-6) 0 var(--sp-10);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex; justify-content: space-between; gap: var(--sp-4);
  }

  @media (max-width: 640px) {
    .page-hd { grid-template-columns: 1fr; }
    .page-hd .counts { text-align: left; }
    .post { grid-template-columns: 1fr auto; }
    .post .date { grid-column: 1 / -1; }
    .post .excerpt { grid-column: 1 / -1; }
  }
`;
