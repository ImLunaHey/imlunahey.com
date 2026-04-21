import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from '@tanstack/react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Repo } from '../data';
import { formatUpdated } from '../lib/format';
import { getRecentCommits } from '../server/commits';
import { getReadme } from '../server/readme';
import { getAllRepos } from '../server/repos';

const LANG_CLS: Record<string, string> = {
  typescript: 'lang-ts',
  rust: 'lang-rs',
  go: 'lang-go',
};

function commitRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (d <= 0) return 'today';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

const IMG_EXT = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)(\?.*)?$/i;

function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#\s+[^\n]+\n*/, '');
}

function rewriteReadmeUrl(owner: string, name: string) {
  const blob = `https://github.com/${owner}/${name}/blob/HEAD/`;
  const raw = `https://raw.githubusercontent.com/${owner}/${name}/HEAD/`;
  return (url: string): string => {
    if (!url) return url;
    if (/^(https?:|mailto:|data:|#)/i.test(url)) return url;
    const cleaned = url.replace(/^\.\//, '').replace(/^\/+/, '');
    return (IMG_EXT.test(cleaned) ? raw : blob) + cleaned;
  };
}

export default function ProjectDetailPage() {
  const params = useParams({ strict: false }) as { name?: string };
  const name = params.name;
  const { data: repoData } = useQuery({ queryKey: ['repos'], queryFn: () => getAllRepos() });

  const repo = repoData && name ? repoData.repos.find((r) => r.name === name) : undefined;

  const { data: readme } = useQuery({
    queryKey: ['readme', repo?.owner, repo?.name],
    queryFn: () => getReadme({ data: { owner: repo!.owner, name: repo!.name } }),
    enabled: !!repo,
  });
  const { data: commits } = useQuery({
    queryKey: ['commits', repo?.owner, repo?.name],
    queryFn: () => getRecentCommits({ data: { owner: repo!.owner, name: repo!.name } }),
    enabled: !!repo,
  });

  return (
    <>
      <style>{CSS}</style>
      {repoData === undefined ? (
        <HeaderSkel />
      ) : !repo ? (
        <Navigate to={'/not-found' as never} replace />
      ) : (
        <Content
          repo={repo}
          related={repoData.repos.filter((r) => r.lang === repo.lang && r.name !== repo.name).slice(0, 3)}
          readme={readme}
          commits={commits}
        />
      )}
    </>
  );
}

function HeaderSkel() {
  return (
    <main className="shell-project">
      <header className="proj-hd">
        <div className="skel" style={{ width: 120, height: 12, marginBottom: 16 }} />
        <div className="skel" style={{ width: '50%', height: 56, marginBottom: 12 }} />
        <div className="skel" style={{ width: '80%', height: 14 }} />
      </header>
    </main>
  );
}

function Content({
  repo,
  related,
  readme,
  commits,
}: {
  repo: Repo;
  related: Repo[];
  readme: string | null | undefined;
  commits: { sha: string; msg: string; date: string }[] | undefined;
}) {
  return (
    <>
      <main className="shell-project">
        <header className="proj-hd">
          <div className="crumbs">
            <Link to="/">~</Link>
            <span className="sep">/</span>
            <Link to="/projects">projects</Link>
            <span className="sep">/</span>
            <span className="last">{repo.name}</span>
          </div>
          <h1>
            {repo.name}
            <span className="dot">.</span>
          </h1>
          <p className="desc">{repo.desc}.</p>
          <div className="meta">
            {repo.kind ? <span className={`kind-pill ${repo.kind}`}>{repo.kind}</span> : null}
            <span className={LANG_CLS[repo.lang] || ''}>● {repo.lang}</span>
            <span>
              ★ <b>{repo.stars}</b>
            </span>
            {repo.commits != null ? (
              <span>
                <b>{repo.commits}</b> commits
              </span>
            ) : null}
            <span>updated <b>{formatUpdated(repo.updated)}</b></span>
            <span className={`status-${repo.status}`} style={{ marginLeft: 'auto' }}>
              ● {repo.status}
            </span>
          </div>
        </header>

        <section className="ctas">
          {repo.launch ? (
            <a className="cta primary" href={repo.launch} target="_blank" rel="noopener noreferrer">
              <span className="lbl">launch</span>
              <span className="val">
                <span>{repo.launch.replace(/^https?:\/\//, '')}</span>
                <span className="arr">↗</span>
              </span>
            </a>
          ) : (
            <div className="cta disabled">
              <span className="lbl">launch</span>
              <span className="val">
                <span>no hosted version</span>
                <span className="arr">—</span>
              </span>
            </div>
          )}
          {repo.source ? (
            <a className="cta" href={repo.source} target="_blank" rel="noopener noreferrer">
              <span className="lbl">source</span>
              <span className="val">
                <span>{repo.source.replace(/^https?:\/\//, '')}</span>
                <span className="arr">↗</span>
              </span>
            </a>
          ) : null}
        </section>

        <div className="body">
          <article className="readme">
            {readme === undefined ? (
              <>
                <div className="skel" style={{ width: '35%', height: 20, marginBottom: 12 }} />
                <div className="skel" style={{ width: '100%', marginBottom: 8 }} />
                <div className="skel" style={{ width: '95%', marginBottom: 8 }} />
                <div className="skel" style={{ width: '88%', marginBottom: 8 }} />
                <div className="skel" style={{ width: '70%' }} />
              </>
            ) : readme ? (
              <Markdown remarkPlugins={[remarkGfm]} urlTransform={rewriteReadmeUrl(repo.owner, repo.name)}>
                {stripLeadingH1(readme)}
              </Markdown>
            ) : (
              <>
                <h2>readme</h2>
                <p>no readme in this repo. the github page is the canonical view.</p>
              </>
            )}
            {repo.writeup ? (
              <Link to={`/blog/${repo.writeup}` as never} className="writeup-callout">
                <div className="icon">¶</div>
                <div className="wc-body">
                  <div className="wc-lbl">long-form writeup</div>
                  <div className="wc-title">read the story behind this project</div>
                  <div className="wc-meta">/writing/{repo.writeup}</div>
                </div>
                <div className="wc-go">→</div>
              </Link>
            ) : null}
          </article>

          <aside className="side">
            <div className="side-box">
              <h3>── facts</h3>
              <dl>
                <dt>language</dt>
                <dd className={LANG_CLS[repo.lang] || ''}>{repo.lang}</dd>
                {repo.kind ? (
                  <>
                    <dt>kind</dt>
                    <dd>{repo.kind}</dd>
                  </>
                ) : null}
                <dt>status</dt>
                <dd>
                  <span className={`status-${repo.status}`}>● {repo.status}</span>
                </dd>
                <dt>stars</dt>
                <dd>
                  <span className="acc">{repo.stars}</span>
                </dd>
                <dt>forks</dt>
                <dd>{repo.forks}</dd>
                {repo.commits != null ? (
                  <>
                    <dt>commits</dt>
                    <dd>{repo.commits}</dd>
                  </>
                ) : null}
                <dt>owner</dt>
                <dd className="dim">{repo.owner}</dd>
                <dt>updated</dt>
                <dd className="dim">{formatUpdated(repo.updated)}</dd>
              </dl>
            </div>

            {commits === undefined ? (
              <div className="side-box">
                <h3>── recent commits</h3>
                <div className="commits-list">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="c">
                      <span className="skel" style={{ width: 80, height: 10 }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : commits.length > 0 ? (
              <div className="side-box">
                <h3>── recent commits</h3>
                <div className="commits-list">
                  {commits.map((c) => (
                    <a
                      key={c.sha}
                      className="c"
                      href={`https://github.com/${repo.owner}/${repo.name}/commit/${c.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="sha">{c.sha}</span>
                      <span className="msg">{c.msg}</span>
                      <span className="when" suppressHydrationWarning>{commitRelative(c.date)}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        {related.length ? (
          <section className="related">
            <div className="related-head">── more in {repo.lang}</div>
            <div className="related-grid">
              {related.map((r) => (
                <RelatedCard key={r.name} repo={r} />
              ))}
            </div>
          </section>
        ) : null}

        <footer className="project-footer">
          <span>
            src: <span className="t-accent">api.github.com/repos/{repo.owner}/{repo.name}</span>
          </span>
          <span>
            ←{' '}
            <Link to="/projects" className="t-accent">
              all projects
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function RelatedCard({ repo }: { repo: Repo }) {
  return (
    <Link to={`/projects/${repo.name}` as never} className="related-card">
      <div className="rc-name">{repo.name}</div>
      <div className="rc-desc">{repo.desc}</div>
    </Link>
  );
}

const CSS = `
  .shell-project { max-width: 920px; margin: 0 auto; padding: 0 var(--sp-6); }

  .proj-hd { padding: var(--sp-8) 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .proj-hd .crumbs { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-3); }
  .proj-hd .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .proj-hd .crumbs a:hover { color: var(--color-accent); }
  .proj-hd .crumbs .sep { color: var(--color-border-bright); margin: 0 6px; }
  .proj-hd .crumbs .last { color: var(--color-accent); }
  .proj-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 7vw, 96px);
    font-weight: 500; letter-spacing: -0.03em;
    color: var(--color-fg); line-height: 0.95;
  }
  .proj-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .proj-hd .desc { color: var(--color-fg-dim); font-size: 18px; margin-top: var(--sp-4); max-width: 60ch; text-wrap: pretty; }
  .proj-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5); font-size: var(--fs-xs); color: var(--color-fg-faint);
    align-items: center;
  }
  .proj-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .lang-ts { color: oklch(0.72 0.14 240); }
  .lang-rs { color: oklch(0.72 0.16 35); }
  .lang-go { color: oklch(0.72 0.14 200); }
  .kind-pill { font-size: 10px; padding: 2px 8px; border: 1px solid var(--color-border-bright); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-fg-dim); }
  .kind-pill.app  { border-color: oklch(0.55 0.13 270); color: oklch(0.8 0.14 270); }
  .kind-pill.tool { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .kind-pill.lib  { border-color: oklch(0.55 0.13 60); color: oklch(0.85 0.14 60); }
  .status-active { color: var(--color-accent); }
  .status-archived { color: var(--color-fg-faint); }
  .status-wip { color: var(--color-warn); }

  .ctas {
    display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3);
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .cta {
    display: flex; flex-direction: column; gap: 4px;
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    text-decoration: none;
    transition: border-color 0.12s, background 0.12s;
  }
  .cta:hover { text-decoration: none; border-color: var(--color-accent-dim); background: var(--color-bg-raised); }
  .cta .lbl { font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.14em; }
  .cta .val { font-family: var(--font-mono); color: var(--color-fg); display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); }
  .cta .val .arr { color: var(--color-fg-faint); transition: transform 0.12s, color 0.12s; }
  .cta:hover .val .arr { color: var(--color-accent); transform: translate(2px, -2px); }
  .cta.primary { border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel)); }
  .cta.primary .val { color: var(--color-accent); }
  .cta.primary:hover { background: color-mix(in oklch, var(--color-accent) 14%, var(--color-bg-panel)); }
  .cta.disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }

  .body {
    display: grid; grid-template-columns: 1fr 280px; gap: var(--sp-8);
    padding: var(--sp-8) 0;
  }
  /* grid children default to min-width: auto (content-sized). if the readme
     contains a long url or a wide code block, that default lets the item
     push the whole grid wider than the viewport. min-width:0 contains it. */
  .readme { min-width: 0; }
  .readme h2 {
    font-family: var(--font-display); font-size: 28px;
    font-weight: 500; letter-spacing: -0.02em;
    margin: var(--sp-6) 0 var(--sp-3);
    color: var(--color-fg);
  }
  .readme h2::before { content: "## "; color: var(--color-accent-dim); font-family: var(--font-mono); font-size: 16px; }
  .readme h2:first-child { margin-top: 0; }
  .readme p {
    color: var(--color-fg); line-height: 1.7; font-size: 15px;
    margin-bottom: var(--sp-3); text-wrap: pretty;
    overflow-wrap: break-word;
  }
  .readme code.inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 6px; font-size: 12px; color: var(--color-accent); font-family: var(--font-mono); }
  .readme a { color: var(--color-accent); }
  .readme a:hover { text-decoration: underline; }

  .code-wrap {
    margin: var(--sp-4) 0;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    min-width: 0;
    max-width: 100%;
  }
  .code-wrap .code-top {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px; border-bottom: 1px solid var(--color-border);
    font-size: 10px; color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .code-wrap .code-top b { color: var(--color-accent-dim); font-weight: 400; }
  .code-wrap .copy {
    border: 1px solid var(--color-border-bright); background: transparent;
    color: var(--color-fg-dim); font: inherit; font-size: 10px;
    padding: 2px 8px; cursor: pointer; text-transform: lowercase;
  }
  .code-wrap .copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .code-wrap .copy.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }
  .code-wrap pre {
    margin: 0; padding: 12px 14px;
    overflow-x: auto;
    font-family: var(--font-mono); font-size: 13px;
    line-height: 1.6; color: var(--color-fg);
  }

  .side { display: flex; flex-direction: column; gap: var(--sp-5); min-width: 0; }
  .side-box {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    min-width: 0;
  }
  .side-box h3 {
    font-size: 10px; color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.14em;
    margin-bottom: var(--sp-3); font-weight: 400;
  }
  .side-box dl { display: grid; grid-template-columns: auto 1fr; gap: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .side-box dt { color: var(--color-fg-faint); }
  .side-box dd {
    color: var(--color-fg);
    text-align: right;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .side-box dd .dim { color: var(--color-fg-faint); }
  .side-box dd .acc { color: var(--color-accent); }

  .activity .bar-row { display: flex; gap: 2px; height: 22px; align-items: end; margin: var(--sp-2) 0 var(--sp-3); }
  .activity .bar { flex: 1; background: var(--color-accent-dim); min-height: 3px; opacity: 0.6; }
  .activity .bar.hi { background: var(--color-accent); opacity: 1; }

  .commits-list { font-family: var(--font-mono); font-size: 11px; line-height: 1.6; }
  .commits-list .c { display: flex; gap: var(--sp-2); border-bottom: 1px dashed var(--color-border); padding: 6px 0; align-items: baseline; color: inherit; text-decoration: none; }
  .commits-list .c:hover .msg { color: var(--color-fg); }
  .commits-list .c:last-child { border-bottom: 0; }
  .commits-list .c .sha { color: var(--color-accent); flex-shrink: 0; }
  .commits-list .c .msg { color: var(--color-fg-dim); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .commits-list .c .when { color: var(--color-fg-faint); flex-shrink: 0; }

  .writeup-callout {
    margin-top: var(--sp-8);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel));
    display: flex; gap: var(--sp-4); align-items: center;
    text-decoration: none;
  }
  .writeup-callout .icon {
    font-family: var(--font-display); font-size: 48px;
    color: var(--color-accent); line-height: 1; text-shadow: 0 0 16px var(--accent-glow);
  }
  .writeup-callout .wc-body { flex: 1; }
  .writeup-callout .wc-lbl { font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 4px; }
  .writeup-callout .wc-title { font-family: var(--font-display); font-size: 22px; color: var(--color-fg); letter-spacing: -0.01em; margin-bottom: 2px; }
  .writeup-callout .wc-meta { font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
  .writeup-callout .wc-go { color: var(--color-accent); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .writeup-callout:hover { border-color: var(--color-accent); text-decoration: none; }
  .writeup-callout:hover .wc-title { color: var(--color-accent); }

  .related { border-top: 1px solid var(--color-border); padding: var(--sp-6) 0; }
  .related-head { font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-3); letter-spacing: 0.08em; text-transform: lowercase; }
  .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); }
  .related-card { border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3); text-decoration: none; }
  .related-card:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .related-card .rc-name { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .related-card:hover .rc-name { color: var(--color-accent); }
  .related-card .rc-desc { font-size: var(--fs-xs); color: var(--color-fg-faint); line-height: 1.5; }

  .project-footer {
    border-top: 1px solid var(--color-border); margin-top: var(--sp-6);
    padding: var(--sp-5) 0 var(--sp-8);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
    display: flex; justify-content: space-between; gap: var(--sp-4); flex-wrap: wrap;
  }

  @media (max-width: 780px) {
    .body { grid-template-columns: 1fr; }
    .ctas { grid-template-columns: 1fr; }
    .related-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .shell-project { padding: 0 var(--sp-4); }
    .proj-hd { padding-top: var(--sp-6); }
    .proj-hd .desc { font-size: 16px; }
    .proj-hd .meta { gap: var(--sp-3); }
    /* writeup callout stacks on narrow screens */
    .writeup-callout { flex-direction: column; align-items: flex-start; gap: var(--sp-2); padding: var(--sp-4); }
    .writeup-callout .icon { font-size: 36px; }
    .writeup-callout .wc-title { font-size: 18px; }
    .readme h2 { font-size: 24px; }
    .readme p { font-size: 14px; }
    .code-wrap pre { font-size: 12px; padding: 10px 12px; }
  }
`;
