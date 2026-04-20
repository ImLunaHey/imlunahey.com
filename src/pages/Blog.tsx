import { Await, getRouteApi, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { BlogData, BlogEntry } from '../server/whitewind';

const blogRoute = getRouteApi('/_main/blog/');

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function groupByYear(posts: BlogEntry[]) {
  const out: Record<string, BlogEntry[]> = {};
  for (const p of posts) {
    const y = p.createdAt.slice(0, 4);
    (out[y] ||= []).push(p);
  }
  return out;
}

export default function BlogPage() {
  const { blog } = blogRoute.useLoaderData();

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
              essays, devlogs, and the occasional half-sentence. i write when something hasn&rsquo;t been said the way
              i&rsquo;d say it. stored on atproto via whitewind.
            </p>
          </div>
          <Await promise={blog} fallback={<HeaderCountsSkel />}>
            {(data) => <HeaderCounts data={data} />}
          </Await>
        </header>

        <Await promise={blog} fallback={<ListSkel />}>
          {(data) => <List entries={data.entries} />}
        </Await>

        <footer className="writing-footer">
          <span>
            src: <span className="t-accent">com.whtwnd.blog.entry</span>
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

function HeaderCounts({ data }: { data: BlogData }) {
  const latest = data.entries[0];
  return (
    <div className="counts">
      <div>
        posts · <b>{data.entries.length}</b>
      </div>
      <div>
        words · <b>{data.totalWords.toLocaleString()}</b>
      </div>
      <div>
        since · <b>{data.since || '—'}</b>
      </div>
      <div>
        last · <b>{latest ? fmtDate(latest.createdAt) : '—'}</b>
      </div>
    </div>
  );
}

function HeaderCountsSkel() {
  return (
    <div className="counts">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <span className="skel" style={{ display: 'inline-block', width: 100, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

function List({ entries }: { entries: BlogEntry[] }) {
  const byYear = useMemo(() => groupByYear(entries), [entries]);
  if (entries.length === 0) return <div className="empty">no posts yet.</div>;
  return (
    <div>
      {Object.entries(byYear).map(([year, items]) => (
        <div key={year}>
          <div className="year-head">
            {year} ─ {items.length} {items.length === 1 ? 'post' : 'posts'}
          </div>
          {items.map((p) => (
            <Link key={p.rkey} to={`/blog/${p.rkey}` as never} className="post">
              <span className="date">{fmtDate(p.createdAt)}</span>
              <span className="title">{p.title}</span>
              <span className="meta">
                <span>{p.readMin}m read</span>
              </span>
              <div className="excerpt">// {p.excerpt}</div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

function ListSkel() {
  return (
    <div>
      <div className="year-head">
        <span className="skel" style={{ display: 'inline-block', width: 120, height: 10 }} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="post">
          <span className="date">
            <span className="skel" style={{ display: 'inline-block', width: 70, height: 10 }} />
          </span>
          <span className="title">
            <span className="skel" style={{ display: 'inline-block', width: '70%', height: 14 }} />
          </span>
          <span className="meta">
            <span className="skel" style={{ display: 'inline-block', width: 50, height: 10 }} />
          </span>
        </div>
      ))}
    </div>
  );
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

  .year-head {
    font-family: var(--font-mono);
    color: var(--color-fg-faint);
    font-size: var(--fs-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: var(--sp-6) 0 var(--sp-3);
    border-bottom: 1px solid var(--color-border);
  }

  .post {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr) auto;
    gap: var(--sp-4);
    padding: var(--sp-4) 0;
    border-bottom: 1px dashed var(--color-border);
    color: inherit;
    text-decoration: none;
    align-items: baseline;
  }
  .post:hover { background: var(--color-bg-raised); text-decoration: none; }
  .post:hover .title { color: var(--color-accent); }
  .post .date { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .post .title { font-size: var(--fs-lg); color: var(--color-fg); }
  .post .meta { font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
  .post .excerpt {
    grid-column: 2 / -1;
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    line-height: 1.5;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-height 0.25s ease, margin-top 0.25s ease, opacity 0.2s ease;
  }
  .post:hover .excerpt {
    max-height: 80px;
    margin-top: var(--sp-2);
    opacity: 1;
  }

  .empty { color: var(--color-fg-faint); font-size: var(--fs-sm); padding: var(--sp-10) 0; text-align: center; }

  .writing-footer {
    display: flex;
    justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
  }
`;
