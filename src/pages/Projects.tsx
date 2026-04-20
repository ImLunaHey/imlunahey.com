import { Await, getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { Repo } from '../data';
import { formatUpdated } from '../lib/format';
import type { ProjectStats } from '../server/repos';

type Filter = string;
type SortKey = 'name' | 'lang' | 'stars' | 'forks' | 'commits' | 'updated' | 'status';

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

const DEFAULT_DIR: Record<SortKey, 1 | -1> = {
  name: 1,
  lang: 1,
  status: 1,
  updated: 1,
  stars: -1,
  forks: -1,
  commits: -1,
};

const projectsRoute = getRouteApi('/_main/projects/');

export default function ProjectsPage() {
  const { repoData } = projectsRoute.useLoaderData();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<1 | -1>(DEFAULT_DIR.updated);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
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
          <Await promise={repoData} fallback={<CountsSkel />}>
            {(d) => <Counts stats={d.stats} />}
          </Await>
        </header>

        <Await promise={repoData} fallback={<PinnedSkel />}>
          {(d) => <PinnedSection repos={d.repos} stats={d.stats} />}
        </Await>

        <div className="section-hd">
          <h2>
            <span className="num">02 //</span>all repos.
          </h2>
          <span className="meta">
            src: <span className="t-accent">live · cached 30m</span>
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

        <Await promise={repoData} fallback={<TableSkel />}>
          {(d) => (
            <RepoTable
              repos={d.repos}
              filter={filter}
              search={search}
              sortKey={sortKey}
              sortDir={sortDir}
              toggleSort={toggleSort}
            />
          )}
        </Await>

        <footer className="projects-footer">
          <span>
            src: <span className="t-accent">api.github.com/users/{'{imlunahey,lucid-softworks,omgimalexis}'}/repos</span> · refresh 1800s
          </span>
        </footer>
      </main>
    </>
  );
}

function Counts({ stats }: { stats: ProjectStats }) {
  return (
    <div className="counts">
      <div>
        repos<b>{stats.repos}</b>
      </div>
      <div>
        stars<b>{stats.stars.toLocaleString()}</b>
      </div>
      <div>
        forks<b>{stats.forks.toLocaleString()}</b>
      </div>
      <div>
        commits<b>{stats.commits.toLocaleString()}</b>
      </div>
      <div>
        active<b>{stats.active}</b>
      </div>
      <div>
        languages<b>{stats.languages}</b>
      </div>
    </div>
  );
}

function CountsSkel() {
  return (
    <div className="counts">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <span className="skel" style={{ display: 'inline-block', width: 60, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

function PinnedSection({ repos, stats }: { repos: Repo[]; stats: ProjectStats }) {
  const pinned = useMemo(() => repos.filter((r) => r.pinned), [repos]);
  if (pinned.length === 0) return null;
  return (
    <>
      <div className="section-hd">
        <h2>
          <span className="num">01 //</span>pinned.
        </h2>
        <span className="meta">
          {pinned.length} of {stats.repos} · hand-picked
        </span>
      </div>
      <section className="pinned">
        {pinned.slice(0, 6).map((r) => (
          <PinnedCard key={`${r.owner}/${r.name}`} repo={r} />
        ))}
      </section>
    </>
  );
}

function PinnedSkel() {
  return (
    <>
      <div className="section-hd">
        <h2>
          <span className="num">01 //</span>pinned.
        </h2>
        <span className="meta"><span className="skel" style={{ display: 'inline-block', width: 120, height: 10 }} /></span>
      </div>
      <section className="pinned">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="pin-card">
            <div className="skel" style={{ width: '60%', height: 14, marginBottom: 8 }} />
            <div className="skel" style={{ width: '80%', height: 10, marginBottom: 6 }} />
            <div className="skel" style={{ width: '100%', height: 10 }} />
          </div>
        ))}
      </section>
    </>
  );
}

function RepoTable({
  repos,
  filter,
  search,
  sortKey,
  sortDir,
  toggleSort,
}: {
  repos: Repo[];
  filter: Filter;
  search: string;
  sortKey: SortKey;
  sortDir: 1 | -1;
  toggleSort: (k: SortKey) => void;
}) {
  const navigate = useNavigate();
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = repos.filter((r) => {
      if (q && !r.name.includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'active' || filter === 'archived' || filter === 'wip') return r.status === filter;
      return r.lang === filter;
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * (((av as number | null) ?? 0) - ((bv as number | null) ?? 0));
    });
    return sorted;
  }, [repos, filter, search, sortKey, sortDir]);

  return (
    <table className="repo-table">
      <thead>
        <tr>
          {(
            [
              ['name', 'repo'],
              ['lang', 'lang'],
              ['stars', 'stars'],
              ['forks', 'forks'],
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
          <tr
            key={`${r.owner}/${r.name}`}
            onClick={() => navigate({ to: `/projects/${r.name}` as never })}
          >
            <td className="nm">
              <div className="n" title={r.name}>{r.name}</div>
              <div className="desc" title={r.desc}>// {r.desc}</div>
            </td>
            <td>
              <span className={LANG_CLS[r.lang] || ''}>●</span> <span className="dim">{r.lang}</span>
            </td>
            <td>{r.stars}</td>
            <td className="dim">{r.forks}</td>
            <td className="dim">{r.commits ?? '—'}</td>
            <td className="dim">{formatUpdated(r.updated)}</td>
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
  );
}

function TableSkel() {
  return (
    <table className="repo-table">
      <tbody>
        {Array.from({ length: 8 }).map((_, i) => (
          <tr key={i}>
            <td className="nm">
              <div className="skel" style={{ width: '40%', height: 12, marginBottom: 4 }} />
              <div className="skel" style={{ width: '70%', height: 10 }} />
            </td>
            <td><div className="skel" style={{ width: 60, height: 10 }} /></td>
            <td><div className="skel" style={{ width: 30, height: 10 }} /></td>
            <td><div className="skel" style={{ width: 30, height: 10 }} /></td>
            <td><div className="skel" style={{ width: 40, height: 10 }} /></td>
            <td><div className="skel" style={{ width: 60, height: 10 }} /></td>
            <td><div className="skel" style={{ width: 60, height: 10 }} /></td>
            <td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PinnedCard({ repo: r }: { repo: Repo }) {
  const navigate = useNavigate();
  const links: React.ReactNode[] = [];
  if (r.launch)
    links.push(
      <a key="launch" className="primary" href={r.launch} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        launch ↗
      </a>,
    );
  if (r.source)
    links.push(
      <a key="source" href={r.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        source ↗
      </a>,
    );
  if (r.writeup)
    links.push(
      <Link key="writeup" to={`/blog/${r.writeup}` as never} onClick={(e) => e.stopPropagation()}>
        writeup →
      </Link>,
    );

  return (
    <div
      className="pin-card"
      role="link"
      tabIndex={0}
      onClick={() => navigate({ to: `/projects/${r.name}` as never })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate({ to: `/projects/${r.name}` as never });
        }
      }}
    >
      <div className="pin-head">
        <span className={LANG_CLS[r.lang] || ''}>● {r.lang}</span>
        {r.kind ? <span className="kind-pill">{r.kind}</span> : null}
        <span>★ {r.stars}</span>
      </div>
      <div className="name">{r.name}</div>
      <div className="desc">{r.desc}</div>
      <div className="ft">
        <span>
          <b>owner</b> {r.owner}
        </span>
        <span>
          <b>updated</b> {formatUpdated(r.updated)}
        </span>
      </div>
      {links.length > 0 ? <div className="links">{links}</div> : null}
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
  .pin-card { cursor: pointer; }
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
  .pin-card .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-family: var(--font-display); font-size: 24px; color: var(--color-fg);
    line-height: 1; letter-spacing: -0.02em;
  }
  .pin-card:hover .name { color: var(--color-accent); }
  .pin-card .desc { font-size: var(--fs-sm); color: var(--color-fg-dim); line-height: 1.5; flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
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
  .repo-table { table-layout: fixed; }
  .repo-table th:nth-child(2), .repo-table td:nth-child(2) { width: 100px; }
  .repo-table th:nth-child(3), .repo-table td:nth-child(3) { width: 55px; }
  .repo-table th:nth-child(4), .repo-table td:nth-child(4) { width: 55px; }
  .repo-table th:nth-child(5), .repo-table td:nth-child(5) { width: 70px; }
  .repo-table th:nth-child(6), .repo-table td:nth-child(6) { width: 90px; }
  .repo-table th:nth-child(7), .repo-table td:nth-child(7) { width: 95px; }
  .repo-table th:nth-child(8), .repo-table td:nth-child(8) { width: 65px; }
  .repo-table .nm { font-family: var(--font-mono); }
  .repo-table .nm .n,
  .repo-table .nm .desc {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .repo-table .desc { color: var(--color-fg-faint); font-size: var(--fs-xs); margin-top: 2px; }
  .repo-table td:not(.nm) { white-space: nowrap; }
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
