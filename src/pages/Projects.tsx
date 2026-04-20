import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ALL_REPOS, PINNED_REPOS, PROJECT_STATS, type Repo, type RepoLang, type RepoStatus } from '../data';

type Filter = 'all' | RepoStatus | RepoLang;
type SortKey = 'name' | 'lang' | 'stars' | 'commits' | 'updated' | 'status';

const LANG_CLS: Record<string, string> = {
  typescript: 'lang-ts',
  rust: 'lang-rs',
  go: 'lang-go',
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'active', label: 'active' },
  { key: 'archived', label: 'archived' },
  { key: 'typescript', label: 'typescript' },
  { key: 'rust', label: 'rust' },
  { key: 'go', label: 'go' },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = ALL_REPOS.filter((r) => {
      if (q && !r.name.includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'active' || filter === 'archived' || filter === 'wip') return r.status === filter;
      return r.lang === filter;
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * (((av as number) ?? 0) - ((bv as number) ?? 0));
    });
    return sorted;
  }, [filter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 1 : -1);
    }
  };

  return (
    <>
      <style>{PROJECTS_CSS}</style>
      <main className="shell-projects">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/projects
          </div>
          <h1>
            projects<span className="dot">.</span>
          </h1>
          <p className="sub">
            open source, experiments, abandoned drafts. some live in production, most live in my recent-folder. filter,
            sort, click to see install commands.
          </p>
          <div className="counts">
            <div>
              repos
              <b>{PROJECT_STATS.repos}</b>
            </div>
            <div>
              stars
              <b>{PROJECT_STATS.stars.toLocaleString()}</b>
            </div>
            <div>
              active
              <b>{PROJECT_STATS.active}</b>
            </div>
            <div>
              languages
              <b>{PROJECT_STATS.languages}</b>
            </div>
          </div>
        </header>

        <div className="section-hd">
          <h2>
            <span className="num">01 //</span>pinned.
          </h2>
          <span className="meta">
            {PINNED_REPOS.length} of {PROJECT_STATS.repos} · hand-picked
          </span>
        </div>

        <section className="pinned">
          {PINNED_REPOS.slice(0, 6).map((r) => (
            <PinnedCard key={r.name} repo={r} />
          ))}
        </section>

        <div className="section-hd">
          <h2>
            <span className="num">02 //</span>all repos.
          </h2>
          <span className="meta">
            src: <span className="t-accent">api.github.com/users/imlunahey/repos</span>
          </span>
        </div>

        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={'f-chip' + (filter === f.key ? ' on' : '')}
              onClick={() => setFilter(f.key)}
              type="button"
            >
              {f.label}
            </button>
          ))}
          <input
            className="input f-search"
            placeholder="filter by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table className="repo-table">
          <thead>
            <tr>
              {(
                [
                  ['name', 'repo'],
                  ['lang', 'lang'],
                  ['stars', '★ stars'],
                  ['commits', 'commits'],
                  ['updated', 'updated'],
                  ['status', 'status'],
                ] as const
              ).map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)}>
                  {label}
                  {sortKey === key ? <span className="arr"> {sortDir > 0 ? '▲' : '▼'}</span> : null}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} onClick={() => navigate({ to: `/projects/${r.name}` as never })}>
                <td className="nm">
                  {r.name}
                  <div className="desc">// {r.desc}</div>
                </td>
                <td>
                  <span className={LANG_CLS[r.lang] || ''}>●</span> <span className="dim">{r.lang}</span>
                </td>
                <td>{r.stars}</td>
                <td className="dim">{r.commits}</td>
                <td className="dim">{r.updated}d ago</td>
                <td>
                  <span className={'status-' + r.status}>● {r.status}</span>
                </td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  {r.launch ? (
                    <a href={r.launch} target="_blank" rel="noopener noreferrer" className="act primary" title="launch">
                      ↗
                    </a>
                  ) : null}
                  {r.source ? (
                    <a href={r.source} target="_blank" rel="noopener noreferrer" className="act" title="source">
                      ◤◥
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="projects-footer">
          <span>
            src: <span className="t-accent">api.github.com/users/imlunahey/repos</span> · refresh 3600s
          </span>
        </footer>
      </main>
    </>
  );
}

function PinnedCard({ repo: r }: { repo: Repo }) {
  const links: React.ReactNode[] = [];
  if (r.launch)
    links.push(
      <a key="launch" className="primary" href={r.launch} target="_blank" rel="noopener noreferrer">
        launch ↗
      </a>,
    );
  if (r.source)
    links.push(
      <a key="source" href={r.source} target="_blank" rel="noopener noreferrer">
        source ↗
      </a>,
    );
  links.push(
    <Link key="details" to={`/projects/${r.name}` as never}>
      details →
    </Link>,
  );
  if (r.writeup)
    links.push(
      <Link key="writeup" to={`/blog/${r.writeup}` as never}>
        writeup →
      </Link>,
    );

  return (
    <div className="pin-card">
      <div className="pin-head">
        <span className={LANG_CLS[r.lang] || ''}>● {r.lang}</span>
        {r.kind ? <span className="kind-pill">{r.kind}</span> : null}
        <span>★ {r.stars}</span>
      </div>
      <div className="name">{r.name}</div>
      <div className="desc">{r.desc}</div>
      <div className="ft">
        <span>
          <b>commits</b> {r.commits}
        </span>
        <span>
          <b>updated</b> {r.updated}d ago
        </span>
      </div>
      <div className="links">{links}</div>
    </div>
  );
}

const PROJECTS_CSS = `
  .shell-projects { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd {
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em;
    color: var(--color-fg); line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }
  .page-hd .counts {
    display: flex; gap: var(--sp-8); margin-top: var(--sp-6);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .counts b {
    color: var(--color-accent); font-weight: 400; display: block;
    font-size: 28px; font-family: var(--font-display);
    margin-top: 2px;
  }

  .section-hd {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
  }
  .section-hd h2 {
    font-family: var(--font-display); font-size: 28px; font-weight: 500; color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .section-hd h2 .num { color: var(--color-accent); font-family: var(--font-mono); font-size: 13px; margin-right: 12px; letter-spacing: 0.08em; }
  .section-hd .meta { font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .pinned {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-3);
  }
  .pin-card {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-3);
    cursor: pointer; transition: border-color 0.12s, background 0.12s;
    position: relative;
  }
  .pin-card:hover { border-color: var(--color-accent-dim); }
  .pin-card .pin-head {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: var(--fs-xs); color: var(--color-fg-faint);
    gap: var(--sp-2);
  }
  .pin-card .name {
    font-family: var(--font-display); font-size: 24px; color: var(--color-fg);
    line-height: 1; letter-spacing: -0.02em;
  }
  .pin-card:hover .name { color: var(--color-accent); }
  .pin-card .desc { font-size: var(--fs-sm); color: var(--color-fg-dim); line-height: 1.5; flex: 1; }
  .pin-card .ft { display: flex; gap: var(--sp-4); font-size: var(--fs-xs); color: var(--color-fg-faint); flex-wrap: wrap; }
  .pin-card .ft b { color: var(--color-fg-dim); font-weight: 400; }
  .pin-card .links { display: flex; gap: var(--sp-2); margin-top: var(--sp-1); border-top: 1px dashed var(--color-border); padding-top: var(--sp-3); }
  .pin-card .links a {
    font-family: var(--font-mono); font-size: 11px;
    padding: 3px 8px; border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim); text-transform: lowercase;
    text-decoration: none;
  }
  .pin-card .links a:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }
  .pin-card .links a.primary { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .pin-card .links a.primary:hover { background: color-mix(in oklch, var(--color-accent) 16%, transparent); }
  .pin-card .kind-pill { font-size: 9px; padding: 1px 6px; border: 1px solid var(--color-border-bright); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-fg-faint); }
  .lang-ts { color: oklch(0.72 0.14 240); }
  .lang-rs { color: oklch(0.72 0.16 35); }
  .lang-go { color: oklch(0.72 0.14 200); }

  .filters {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: var(--sp-3) 0;
    border-bottom: 1px solid var(--color-border);
    align-items: center;
  }
  .f-chip {
    padding: 4px 10px; border: 1px solid var(--color-border); background: var(--color-bg-panel);
    color: var(--color-fg-dim); font-size: var(--fs-xs); cursor: pointer;
    text-transform: lowercase;
    font-family: var(--font-mono);
  }
  .f-chip:hover { border-color: var(--color-border-bright); color: var(--color-fg); }
  .f-chip.on { border-color: var(--color-accent-dim); color: var(--color-accent); background: var(--color-bg-raised); }
  .f-search { margin-left: auto; max-width: 240px; }

  .repo-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
    margin-top: var(--sp-3);
  }
  .repo-table th {
    text-align: left; padding: 8px 12px;
    color: var(--color-fg-faint); font-weight: 400;
    font-size: var(--fs-xs); text-transform: lowercase;
    border-bottom: 1px solid var(--color-border-bright);
    cursor: pointer;
    user-select: none;
  }
  .repo-table th:hover { color: var(--color-accent); }
  .repo-table th .arr { color: var(--color-accent); opacity: 0.6; }
  .repo-table td {
    padding: 10px 12px;
    border-bottom: 1px dashed var(--color-border);
    color: var(--color-fg);
  }
  .repo-table tbody tr { cursor: pointer; }
  .repo-table tbody tr:hover td { background: var(--color-bg-raised); }
  .repo-table tbody tr:hover td:first-child { color: var(--color-accent); }
  .repo-table .nm { font-family: var(--font-mono); }
  .repo-table .desc { color: var(--color-fg-faint); font-size: var(--fs-xs); margin-top: 2px; }
  .repo-table .dim { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .repo-table .status-active { color: var(--color-accent); }
  .repo-table .status-archived { color: var(--color-fg-faint); }
  .repo-table .status-wip { color: var(--color-warn); }

  .repo-table .act {
    color: var(--color-fg-dim); padding: 2px 6px;
    border: 1px solid var(--color-border); font-family: var(--font-mono);
    font-size: 11px; margin-right: 4px; display: inline-block;
    text-decoration: none;
  }
  .repo-table .act:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }
  .repo-table .act.primary { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .repo-table td.actions { white-space: nowrap; text-align: right; }

  .projects-footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-10); padding: var(--sp-6) 0 var(--sp-10);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
    display: flex; justify-content: space-between;
  }

  @media (max-width: 860px) {
    .pinned { grid-template-columns: 1fr; }
  }
`;
