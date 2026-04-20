import { Await, getRouteApi, Link } from '@tanstack/react-router';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ABOUT, SITE, SOCIALS, SOURCES, STATUS, USES } from '../data';
import { LASTFM_PROFILE_URL } from '../server/lastfm';
import { formatUpdated } from '../lib/format';

const homeRoute = getRouteApi('/_main/');

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
};

const fmtMonthYear = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toLowerCase();
};

const BskySkel = () => (
  <>
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bsky-post">
        <div className="skel" style={{ width: '100%', marginBottom: 6 }} />
        <div className="skel" style={{ width: '60%' }} />
      </div>
    ))}
  </>
);

const MusicSkel = () => (
  <div className="music-wrap">
    <div className="music-top">
      <div className="skel music-art" style={{ height: 72 }} />
      <div className="music-meta" style={{ flex: 1 }}>
        <div className="skel" style={{ width: '40%', height: 10, marginBottom: 8 }} />
        <div className="skel" style={{ width: '85%', marginBottom: 6 }} />
        <div className="skel" style={{ width: '55%' }} />
      </div>
    </div>
  </div>
);

const WatchingSkel = () => (
  <>
    <div className="skel" style={{ width: 130, height: 14, marginBottom: 12 }} />
    <div className="watch-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="poster skel" style={{ aspectRatio: '2/3' }} />
      ))}
    </div>
  </>
);

const BlogSkel = () => (
  <>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="blog-row">
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ width: '70%', height: 10, marginBottom: 4 }} />
          <div className="skel" style={{ width: '50%', height: 12 }} />
        </div>
      </div>
    ))}
  </>
);

const ContribSkel = () => (
  <>
    <div className="contrib-top">
      <div className="skel" style={{ width: 180, height: 28 }} />
    </div>
    <div className="contrib">
      {Array.from({ length: 53 }).map((_, wi) => (
        <div key={wi} className="wk">
          {Array.from({ length: 7 }).map((_, di) => (
            <div key={di} className="d" />
          ))}
        </div>
      ))}
    </div>
  </>
);

const langCls: Record<string, string> = {
  typescript: 'lang-ts',
  rust: 'lang-rs',
  go: 'lang-go',
};

export default function HomePage() {
  const { repos, stats, contribs, bskyPosts, lastTrack, blog, weather, watches } = homeRoute.useLoaderData();
  const pinned = repos.filter((r) => r.pinned).slice(0, 6);
  const latestActiveRepo = repos
    .filter((r) => r.status === 'active')
    .reduce<(typeof repos)[number] | undefined>(
      (min, r) => (min === undefined || r.updated < min.updated ? r : min),
      undefined,
    );

  return (
    <>
      <style>{HOME_CSS}</style>
      <main className="shell">
        {/* command bar */}
        <div className="cmdbar">
          <span>
            <span className="ok">●</span> <b>online</b>
          </span>
          <span>
            <b>repos</b> {stats.repos}
          </span>
          <span>
            <b>stars</b> {stats.stars.toLocaleString()}
          </span>
          <span>
            <b>commits</b> {stats.commits.toLocaleString()}
          </span>
          <span>
            <b>langs</b> {stats.languages}
          </span>
          {latestActiveRepo ? (
            <span>
              <b>last push</b> {formatUpdated(latestActiveRepo.updated)}
            </span>
          ) : null}
        </div>

        {/* hero */}
        <section className="hero">
          <div>
            <h1>
              hi, i'm
              <br />
              <span className="green">{SITE.name}.</span>
            </h1>
            <p className="sub">
              {ABOUT.blurb}
              <span className="cursor" />
            </p>
          </div>
          <aside className="vitals">
            <div className="row on">
              <span>status</span>
              <b>● online</b>
            </div>
            <div className="row">
              <span>location</span>
              <b>{SITE.location}</b>
            </div>
            <div className="row">
              <span>timezone</span>
              <b>{SITE.tz.toLowerCase()}</b>
            </div>
            <div className="row">
              <span>pronouns</span>
              <b>{SITE.pronouns}</b>
            </div>
            <hr />
            <div className="row">
              <span>stack</span>
              <b>{ABOUT.tags.join(' · ')}</b>
            </div>
            <div className="row">
              <span>editor</span>
              <b>{USES.software.find((s) => s.tag === 'editor')?.name ?? USES.software[0]?.name}</b>
            </div>
            <div className="row">
              <span>runtime</span>
              <b>{USES.runtime.find((r) => r.tag === 'primary')?.name ?? USES.runtime[0]?.name}</b>
            </div>
            <hr />
            <div className="row">
              <span>contact</span>
              <b className="t-accent">{SITE.email}</b>
            </div>
          </aside>
        </section>

        {/* 01 · current */}
        <div className="section-head">
          <h2>
            <span className="num">01 //</span>current
          </h2>
          <div className="right">
            <span className="src">
              src: <b>static · bsky · last.fm · open-meteo</b>
            </span>
          </div>
        </div>

        <section className="bento">
          {/* NOW */}
          <div className="panel c-now">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">~/now</span>
              <span className="src-tag">// live</span>
            </div>
            <div className="panel-body">
              <div className="now-wrap">
                <div>
                  <div className="label">currently</div>
                  <div className="now-headline">
                    building
                    <br />
                    <span className="dim">and tinkering.</span>
                  </div>
                </div>
                <dl className="now-grid">
                  {latestActiveRepo ? (
                    <div style={{ display: 'contents' }}>
                      <dt>// building</dt>
                      <dd>
                        <span className="bullet">→</span>
                        <Link to={`/projects/${latestActiveRepo.name}` as never} className="glow-link">
                          {latestActiveRepo.name}
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                  <ErrorBoundary fallback={null}>
                    <Await promise={blog} fallback={null}>
                      {(b) =>
                        b.entries[0] ? (
                          <div style={{ display: 'contents' }}>
                            <dt>// writing</dt>
                            <dd>
                              <span className="bullet">→</span>
                              <Link to={`/blog/${b.entries[0].rkey}` as never} className="glow-link">
                                {b.entries[0].title.toLowerCase()}
                              </Link>
                            </dd>
                          </div>
                        ) : null
                      }
                    </Await>
                  </ErrorBoundary>
                  <ErrorBoundary fallback={null}>
                    <Await promise={lastTrack} fallback={null}>
                      {(t) =>
                        t && t.nowPlaying ? (
                          <div style={{ display: 'contents' }}>
                            <dt>// listening</dt>
                            <dd>
                              <span className="bullet">→</span>
                              <a href={t.url} target="_blank" rel="noopener noreferrer" className="glow-link">
                                {`${t.artist} — ${t.track}`.toLowerCase()}
                              </a>
                            </dd>
                          </div>
                        ) : null
                      }
                    </Await>
                  </ErrorBoundary>
                  <ErrorBoundary fallback={null}>
                    <Await promise={watches} fallback={null}>
                      {(w) =>
                        w.items[0] ? (
                          <div style={{ display: 'contents' }}>
                            <dt>// watching</dt>
                            <dd>
                              <span className="bullet">→</span>
                              {w.items[0].title.toLowerCase()}
                            </dd>
                          </div>
                        ) : null
                      }
                    </Await>
                  </ErrorBoundary>
                  {latestActiveRepo ? (
                    <div style={{ display: 'contents' }}>
                      <dt>// last commit</dt>
                      <dd>
                        <span className="bullet">→</span>
                        {`${latestActiveRepo.name} · ${formatUpdated(latestActiveRepo.updated)}`}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
          </div>

          {/* VITALS (weather + DND) */}
          <div className="c-vitals-sm">
            <div className="vitals-sm">
              <div className="vitals-cell">
                <ErrorBoundary fallback={<div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>weather unavailable</div>}>
                  <Await promise={weather} fallback={<div className="skel" style={{ width: 80, height: 28 }} />}>
                    {(w) =>
                      w ? (
                        <>
                          <div>
                            <span className="lb">weather</span>
                            <div className="big accent">{w.tempC}°</div>
                          </div>
                          <span className="sub">
                            {w.code} · london
                          </span>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="lb">weather</span>
                            <div className="big accent">—</div>
                          </div>
                          <span className="sub">offline · london</span>
                        </>
                      )
                    }
                  </Await>
                </ErrorBoundary>
              </div>
              <div className="vitals-cell">
                <div>
                  <span className="lb">do not disturb</span>
                  <div className="big">{STATUS.backAt}</div>
                </div>
                <span className="sub">back online at</span>
              </div>
            </div>
          </div>

          {/* MUSIC */}
          <div className="panel c-music">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">./now_playing</span>
              <a
                className="src-tag"
                href={LASTFM_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                // last.fm
              </a>
            </div>
            <div className="panel-body">
              <ErrorBoundary fallback={<div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>music panel errored.</div>}>
              <Await promise={lastTrack} fallback={<MusicSkel />}>
                {(t) =>
                  t && t.nowPlaying ? (
                    <div className="music-wrap">
                      <div className="music-top">
                        <div
                          className="music-art"
                          style={t.art ? { backgroundImage: `url(${t.art})`, backgroundSize: 'cover' } : undefined}
                        />
                        <div className="music-meta">
                          <div className="label">now playing</div>
                          <a
                            className="music-track"
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.track.toLowerCase()}
                          </a>
                          <a
                            className="music-artist"
                            href={t.artistUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.artist.toLowerCase()}
                          </a>
                        </div>
                      </div>
                      <div className="music-bars playing">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <span key={i} />
                        ))}
                      </div>
                      <Link to={'/music' as never} className="see-all">
                        full history →
                      </Link>
                    </div>
                  ) : (
                    <div className="music-wrap idle">
                      <div className="music-top">
                        <div className="music-art" />
                        <div className="music-meta">
                          <div className="label">
                            {t === null ? 'not configured' : 'not listening to anything'}
                          </div>
                          {t === null ? (
                            <div className="music-artist">set LASTFM_API_KEY</div>
                          ) : null}
                        </div>
                      </div>
                      {t !== null ? (
                        <Link to={'/music' as never} className="see-all">
                          full history →
                        </Link>
                      ) : null}
                    </div>
                  )
                }
              </Await>
              </ErrorBoundary>
            </div>
          </div>
        </section>

        {/* 02 · writing */}
        <div className="section-head">
          <h2>
            <span className="num">02 //</span>writing.
          </h2>
          <div className="right">
            <span className="src">
              src: <b>whtwnd · public.api.bsky.app</b>
            </span>
            <Link to="/blog" className="glow-link">
              view all →
            </Link>
          </div>
        </div>

        <section className="bento">
          {/* BSKY */}
          <div className="panel c-bsky">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">./bsky --all</span>
              <span className="src-tag">// get_author_feed</span>
            </div>
            <div className="panel-body tight">
              <ErrorBoundary fallback={<div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>bluesky unavailable.</div>}>
              <Await promise={bskyPosts} fallback={<BskySkel />}>
                {(posts) =>
                  posts.length === 0 ? (
                    <div className="bsky-post">
                      <div className="txt">no recent posts.</div>
                    </div>
                  ) : (
                    <>
                      {posts.map((p) => (
                        <a
                          key={p.url}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bsky-post"
                        >
                          <div className="txt">{p.text}</div>
                          <div className="meta">
                            <span className="t-faint">@{p.handle}</span>
                            <span suppressHydrationWarning>{fmtDate(p.ts)}</span>
                            <span>
                              <b>♥</b> {p.likes}
                            </span>
                            <span>
                              <b>↩</b> {p.replies}
                            </span>
                            <span>
                              <b>↻</b> {p.reposts}
                            </span>
                            <span style={{ marginLeft: 'auto' }} className="t-accent">
                              read →
                            </span>
                          </div>
                        </a>
                      ))}
                    </>
                  )
                }
              </Await>
              </ErrorBoundary>
            </div>
          </div>

          {/* BLOG */}
          <div className="panel c-blog">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">./blog --latest</span>
              <span className="src-tag">// whtwnd</span>
            </div>
            <div className="panel-body tight">
              <ErrorBoundary fallback={<div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>blog unavailable.</div>}>
                <Await promise={blog} fallback={<BlogSkel />}>
                  {(b) =>
                    b.entries.length === 0 ? (
                      <div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>no posts yet.</div>
                    ) : (
                      <>
                        {b.entries.slice(0, 6).map((e) => (
                          <Link key={e.rkey} to={`/blog/${e.rkey}` as never} className="blog-row">
                            <div>
                              <span className="dt">{e.createdAt.slice(0, 10)}</span>
                              <span className="tt">{e.title}</span>
                            </div>
                            <span className="rt">{e.readMin}m read</span>
                          </Link>
                        ))}
                      </>
                    )
                  }
                </Await>
              </ErrorBoundary>
            </div>
          </div>
        </section>

        {/* 03 · building */}
        <div className="section-head">
          <h2>
            <span className="num">03 //</span>building.
          </h2>
          <div className="right">
            <span className="src">
              src: <b>api.github.com</b>
            </span>
          </div>
        </div>

        <section className="bento">
          {/* ACTIVITY */}
          <div className="panel c-activity">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">git.activity --year</span>
              <span className="src-tag">// users/imlunahey/events</span>
            </div>
            <div className="panel-body">
              <ErrorBoundary fallback={<div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>contributions unavailable.</div>}>
              <Await promise={contribs} fallback={<ContribSkel />}>
                {(c) =>
                  c ? (
                    <>
                      <div className="contrib-top">
                        <div>
                          <span className="big">{c.totalContributions.toLocaleString()}</span>
                          <span className="t-faint" style={{ fontSize: 'var(--fs-xs)', marginLeft: 8 }}>
                            contributions · past 365 days
                          </span>
                        </div>
                        <div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>
                          longest streak · <span className="t-accent">{c.longestStreak}d</span>
                        </div>
                      </div>
                      <div className="contrib">
                        {c.weeks.map((wk, wi) => (
                          <div key={wi} className="wk">
                            {wk.map((d) => (
                              <div
                                key={d.date}
                                className={`d${d.level ? ' l' + d.level : ''}`}
                                data-tip={`${d.count} contribution${d.count === 1 ? '' : 's'} · ${d.date}`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="contrib-legend">
                        <span>{fmtMonthYear(c.rangeStart)}</span>
                        <div className="scale">
                          <span>less</span>
                          <span className="sq" />
                          <span
                            className="sq"
                            style={{ background: 'color-mix(in oklch, var(--color-accent) 28%, var(--color-bg))' }}
                          />
                          <span
                            className="sq"
                            style={{ background: 'color-mix(in oklch, var(--color-accent) 55%, var(--color-bg))' }}
                          />
                          <span
                            className="sq"
                            style={{ background: 'color-mix(in oklch, var(--color-accent) 80%, var(--color-bg))' }}
                          />
                          <span className="sq" style={{ background: 'var(--color-accent)' }} />
                          <span>more</span>
                        </div>
                        <span>{fmtMonthYear(c.rangeEnd)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>
                      github contributions unavailable. set GITHUB_TOKEN.
                    </div>
                  )
                }
              </Await>
              </ErrorBoundary>
            </div>
          </div>

          {/* PROJECTS */}
          <div className="panel c-projects">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">./projects --pinned</span>
              <span className="src-tag">// users/imlunahey/repos</span>
            </div>
            <div className="panel-body tight">
              {pinned.map((r) => (
                <div key={`${r.owner}/${r.name}`} className="proj-row">
                  <div>
                    <div className="pn">{r.name}</div>
                    <div className="pd">// {r.desc}</div>
                  </div>
                  <div className="pm">
                    <div>
                      <span className={langCls[r.lang] || ''}>●</span> {r.lang}
                    </div>
                    <div>★ {r.stars}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WATCHING */}
          <div className="panel c-watching">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">./watching</span>
              <span className="src-tag">// popfeed.social</span>
            </div>
            <div className="panel-body">
              <ErrorBoundary fallback={<div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>popfeed unavailable.</div>}>
                <Await promise={watches} fallback={<WatchingSkel />}>
                  {(w) => (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                        <span className="label">recently watched</span>
                        <span className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>
                          {w.items.length} review{w.items.length === 1 ? '' : 's'}
                          {w.thisYear > 0 ? ` · ${w.thisYear} this year` : ''}
                        </span>
                      </div>
                      {w.items.length === 0 ? (
                        <div className="t-faint" style={{ fontSize: 'var(--fs-xs)' }}>no reviews yet.</div>
                      ) : (
                        <>
                          <div className="watch-grid">
                            {w.items.slice(0, 9).map((it) => {
                              const style = it.poster
                                ? { backgroundImage: `url(${it.poster})`, backgroundSize: 'cover' as const, backgroundPosition: 'center' }
                                : undefined;
                              return (
                                <Link
                                  key={it.rkey}
                                  to={`/watching/${it.rkey}` as never}
                                  className="poster"
                                  style={style}
                                  aria-label={it.title}
                                />
                              );
                            })}
                          </div>
                          <Link to={'/watching' as never} className="see-all">
                            all reviews →
                          </Link>
                        </>
                      )}
                    </>
                  )}
                </Await>
              </ErrorBoundary>
            </div>
          </div>
        </section>

        {/* 04 · rig */}
        <div className="section-head">
          <h2>
            <span className="num">04 //</span>rig.
          </h2>
          <div className="right">
            <span className="src">
              src: <b>static</b>
            </span>
          </div>
        </div>

        <section className="bento">
          {/* STACK */}
          <div className="panel c-stack">
            <div className="panel-head">
              <span className="dot" />
              <span className="ttl">./uses</span>
              <span className="src-tag">// /etc</span>
            </div>
            <div className="panel-body tight">
              {(['hardware', 'software', 'runtime'] as const).map((group) => (
                <div key={group} className="stack-grp">
                  <div className="stack-hdr">
                    <span>{group}</span>
                    <span>{USES[group].length}</span>
                  </div>
                  {USES[group].map((i) => (
                    <div key={i.name} className="stack-item">
                      <span>{i.name}</span>
                      <span className="tag">{i.tag}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* SOCIALS */}
          <div className="c-socials">
            <div className="socials-row">
              {SOCIALS.map((s) =>
                s.url ? (
                  <a key={s.net} className="social-cell" href={s.url}>
                    <span className="net">{s.net}</span>
                    <span className="h">{s.handle}</span>
                  </a>
                ) : (
                  <div key={s.net} className="social-cell">
                    <span className="net">{s.net}</span>
                    <span className="h">{s.handle}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* CONTACT */}
          <div className="c-contact">
            <div className="contact-bar">
              <div>
                <div className="big">
                  say hi at <span className="em">{SITE.email}</span>
                  <span className="cursor" />
                </div>
                <div className="sub">or any of the above. replies within 1–3 days.</div>
              </div>
              <a href={`mailto:${SITE.email}`} className="btn primary">
                send.mail
              </a>
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <div>
            <h3>data sources</h3>
            <div className="sources">
              {SOURCES.map((s) => (
                <div key={s.key}>
                  <span className="k">{s.key}</span>
                  <span className="v">
                    {s.source} · {s.refresh}s
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3>colophon</h3>
            <div style={{ lineHeight: 1.8 }}>
              built with bun + vite + react
              <br />
              mono by jetbrains · display by doto
              <br />
              phosphor accent: <span className="t-accent">oklch(0.86 0.19 145)</span>
              <br />
              <br />
              <span className="t-faint">design.sys {SITE.version}</span>
              <br />
              <br />© 2026 luna hey · crafted in mono
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

const HOME_CSS = `
  .shell { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }

  .cmdbar {
    display: flex;
    gap: var(--sp-5);
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    overflow-x: auto;
    white-space: nowrap;
  }
  .cmdbar .ok { color: var(--color-accent); }
  .cmdbar .warn { color: var(--color-warn); }
  .cmdbar b { color: var(--color-fg-dim); font-weight: 400; }

  .hero {
    padding: 72px 0 56px;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--sp-8);
    align-items: end;
    border-bottom: 1px solid var(--color-border);
    position: relative;
  }
  .hero::before {
    content: "~/user.current";
    position: absolute;
    top: 32px; left: 0;
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.05em;
  }
  .hero h1 {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: clamp(60px, 11vw, 156px);
    line-height: 0.88;
    letter-spacing: -0.04em;
    color: var(--color-fg);
  }
  .hero h1 .green {
    color: var(--color-accent);
    text-shadow: 0 0 20px var(--accent-glow);
  }
  .hero .sub {
    margin-top: var(--sp-5);
    font-size: 14px;
    color: var(--color-fg-dim);
    max-width: 58ch;
    line-height: 1.65;
  }

  .hero .vitals {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .hero .vitals .row { display: flex; justify-content: space-between; gap: var(--sp-3); }
  .hero .vitals .row b { color: var(--color-fg); font-weight: 400; }
  .hero .vitals .row.on b { color: var(--color-accent); }
  .hero .vitals hr {
    border: 0; height: 1px; background: var(--color-border);
    margin: 4px 0;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
  }
  .section-head h2 {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 500;
    color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .section-head h2 .num {
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: 13px;
    margin-right: 14px;
    letter-spacing: 0.08em;
    vertical-align: middle;
  }
  .section-head .right {
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex;
    gap: var(--sp-4);
    align-items: center;
  }
  .section-head .src {
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
  }
  .section-head .src b { color: var(--color-accent-dim); font-weight: 400; }

  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: minmax(110px, auto);
    gap: var(--sp-3);
  }
  .c-now       { grid-column: span 7; grid-row: span 2; }
  .c-vitals-sm { grid-column: span 5; }
  .c-music     { grid-column: span 5; }
  .c-bsky      { grid-column: span 7; grid-row: span 2; }
  .c-blog      { grid-column: span 5; grid-row: span 2; }
  .c-activity  { grid-column: span 12; }
  .c-projects  { grid-column: span 7; grid-row: span 2; }
  .c-watching  { grid-column: span 5; grid-row: span 2; }
  .c-stack     { grid-column: span 5; grid-row: span 2; }
  .c-socials   { grid-column: span 7; }
  .c-contact   { grid-column: span 12; }

  @media (max-width: 980px) {
    .hero { grid-template-columns: 1fr; }
    .bento { grid-template-columns: repeat(6, 1fr); }
    .bento > * { grid-column: span 6 !important; grid-row: auto !important; }
  }
  @media (max-width: 560px) {
    .shell { padding: 0 var(--sp-4); }
    .bento { grid-template-columns: 1fr; }
    .bento > * { grid-column: span 1 !important; }
  }

  /* NOW */
  .now-wrap { display: flex; flex-direction: column; height: 100%; gap: var(--sp-4); }
  .now-headline {
    font-family: var(--font-display);
    font-size: clamp(32px, 4vw, 52px);
    line-height: 0.98;
    letter-spacing: -0.02em;
    color: var(--color-accent);
    text-shadow: 0 0 14px var(--accent-glow);
  }
  .now-headline .dim { color: var(--color-fg); text-shadow: none; }
  .now-grid {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 10px 14px;
    font-size: var(--fs-sm);
    align-items: baseline;
  }
  .now-grid dt { white-space: nowrap; }
  .now-grid dt { color: var(--color-fg-faint); font-size: var(--fs-xs); padding-top: 2px; }
  .now-grid dd { color: var(--color-fg); }
  .now-grid dd .bullet { color: var(--color-accent); margin-right: 4px; }

  /* vitals strip */
  .vitals-sm {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    height: 100%;
  }
  .vitals-cell {
    background: var(--color-bg-panel);
    padding: var(--sp-3) var(--sp-4);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .vitals-cell .lb { font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .vitals-cell .big {
    font-family: var(--font-display);
    font-size: 40px;
    line-height: 1;
    color: var(--color-fg);
    margin-top: 8px;
  }
  .vitals-cell .big.accent { color: var(--color-accent); text-shadow: 0 0 8px var(--accent-glow); }
  .vitals-cell .sub { font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 4px; }

  /* music */
  .music-wrap { display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: var(--sp-3); }
  .music-top { display: flex; gap: var(--sp-3); align-items: flex-start; }
  .music-art {
    width: 72px; height: 72px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
    flex-shrink: 0;
    position: relative;
  }
  .music-art::after {
    content: "♪"; position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-accent); font-size: 24px; text-shadow: 0 0 8px var(--accent-glow);
  }
  .music-meta { display: flex; flex-direction: column; min-width: 0; }
  .music-meta .lb { font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .music-track { font-size: var(--fs-sm); color: var(--color-fg); margin-top: 4px; line-height: 1.3; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .music-track:hover { color: var(--color-accent); text-decoration: none; }
  a.music-artist { font-size: var(--fs-xs); color: var(--color-fg-dim); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  a.music-artist:hover { color: var(--color-accent); text-decoration: none; }
  .music-artist { font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .panel-head a.src-tag { color: var(--color-fg-faint); text-decoration: none; }
  .panel-head a.src-tag:hover { color: var(--color-accent); text-decoration: none; }
  a.see-all {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-decoration: none;
    padding-top: var(--sp-3);
    margin-top: auto;
    align-self: flex-start;
  }
  a.see-all:hover { color: var(--color-accent); text-decoration: none; }
  .music-bars { display: flex; align-items: flex-end; gap: 3px; height: 24px; }
  .music-bars span {
    display: block; width: 4px; background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow); animation: eq 0.9s ease-in-out infinite;
  }
  .music-bars span:nth-child(1){animation-delay:0s}
  .music-bars span:nth-child(2){animation-delay:.15s}
  .music-bars span:nth-child(3){animation-delay:.3s}
  .music-bars span:nth-child(4){animation-delay:.45s}
  .music-bars span:nth-child(5){animation-delay:.6s}
  .music-bars span:nth-child(6){animation-delay:.2s}
  .music-bars span:nth-child(7){animation-delay:.4s}
  @keyframes eq { 0%,100%{height:30%} 50%{height:100%} }
  .music-prog { display: flex; justify-content: space-between; font-size: 10px; color: var(--color-fg-faint); margin-top: 4px; }

  /* bluesky posts */
  .bsky-post {
    display: block;
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
    font-size: var(--fs-sm);
    color: inherit;
    text-decoration: none;
  }
  .bsky-post:hover { text-decoration: none; }
  .bsky-post:hover .txt { color: var(--color-accent); }
  .bsky-post:first-child { padding-top: 0; }
  .bsky-post:last-child { border-bottom: 0; }
  .bsky-post .txt { color: var(--color-fg); line-height: 1.55; }
  .bsky-post .meta {
    display: flex; gap: var(--sp-3); flex-wrap: wrap;
    margin-top: 4px;
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .bsky-post .meta b { color: var(--color-fg-dim); font-weight: 400; }

  /* blog */
  .blog-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-3);
    padding: 10px 0;
    border-bottom: 1px dashed var(--color-border);
    font-size: var(--fs-sm);
    cursor: pointer;
    align-items: baseline;
    text-decoration: none;
    color: inherit;
  }
  .blog-row:last-child { border-bottom: 0; }
  .blog-row:hover { text-decoration: none; }
  .blog-row:hover .tt { color: var(--color-accent); }
  .blog-row .dt { color: var(--color-fg-faint); font-size: var(--fs-xs); display: block; margin-bottom: 2px; }
  .blog-row .tt { color: var(--color-fg); line-height: 1.4; }
  .blog-row .rt { color: var(--color-fg-faint); font-size: var(--fs-xs); white-space: nowrap; }

  /* contribution */
  .panel.c-activity { overflow: visible; }
  .contrib {
    display: grid;
    grid-template-columns: repeat(53, 1fr);
    gap: 2px;
    margin-top: var(--sp-3);
  }
  .contrib .wk { display: flex; flex-direction: column; gap: 2px; }
  .contrib .d { width: 100%; aspect-ratio: 1; background: var(--color-bg-raised); border: 1px solid var(--color-border); position: relative; }
  .contrib .d::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    padding: 4px 8px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.08s ease;
    z-index: 10;
  }
  .contrib .d:hover::after { opacity: 1; }
  .contrib .d.l1 { background: color-mix(in oklch, var(--color-accent) 28%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 30%, var(--color-bg)); }
  .contrib .d.l2 { background: color-mix(in oklch, var(--color-accent) 55%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 55%, var(--color-bg)); }
  .contrib .d.l3 { background: color-mix(in oklch, var(--color-accent) 80%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 80%, var(--color-bg)); }
  .contrib .d.l4 { background: var(--color-accent); border-color: var(--color-accent); box-shadow: 0 0 4px var(--accent-glow); }
  .contrib-top { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-4); flex-wrap: wrap; }
  .contrib-top .big {
    font-family: var(--font-display);
    font-size: 48px; line-height: 1;
    color: var(--color-accent);
    text-shadow: 0 0 12px var(--accent-glow);
  }
  .contrib-legend {
    display: flex; justify-content: space-between;
    margin-top: var(--sp-3); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .contrib-legend .scale { display: flex; gap: 2px; align-items: center; }
  .contrib-legend .sq { width: 10px; height: 10px; background: var(--color-bg-raised); border: 1px solid var(--color-border); }

  /* projects */
  .proj-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
    align-items: baseline;
    cursor: pointer;
  }
  .proj-row:last-child { border-bottom: 0; }
  .proj-row:hover .pn { color: var(--color-accent); }
  .pn { font-size: var(--fs-sm); color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pd { font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pm { font-size: var(--fs-xs); color: var(--color-fg-dim); text-align: right; }
  .pm .lang-ts { color: oklch(0.72 0.14 240); }
  .pm .lang-rs { color: oklch(0.72 0.16 35); }
  .pm .lang-go { color: oklch(0.72 0.14 200); }

  /* watching */
  .watch-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-2);
  }
  .poster {
    aspect-ratio: 2/3;
    background-color: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    display: block;
    cursor: pointer;
    text-decoration: none;
  }
  .poster:hover { border-color: var(--color-accent); text-decoration: none; }
  .poster .rating {
    position: absolute; top: 4px; right: 4px;
    background: var(--color-bg); border: 1px solid var(--color-border-bright);
    padding: 1px 4px; font-size: 10px; color: var(--color-accent);
  }
  .poster .kind {
    position: absolute; top: 4px; left: 4px;
    font-size: 9px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em;
  }

  /* stack */
  .stack-grp { margin-bottom: var(--sp-3); }
  .stack-grp:last-child { margin-bottom: 0; }
  .stack-hdr {
    display: flex; justify-content: space-between;
    font-size: var(--fs-xs); color: var(--color-fg-faint);
    margin-bottom: 6px;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 4px;
  }
  .stack-item { display: flex; justify-content: space-between; font-size: var(--fs-sm); padding: 3px 0; color: var(--color-fg); }
  .stack-item .tag { color: var(--color-fg-faint); font-size: var(--fs-xs); }

  /* socials */
  .socials-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
  }
  .social-cell {
    background: var(--color-bg-panel);
    padding: var(--sp-3) var(--sp-4);
    display: flex; flex-direction: column; gap: 4px;
    cursor: pointer;
    transition: background 0.12s;
    text-decoration: none;
    color: inherit;
  }
  .social-cell:hover { background: var(--color-bg-raised); text-decoration: none; }
  .social-cell .net { font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .social-cell .h { color: var(--color-fg); font-size: var(--fs-sm); }
  .social-cell:hover .h { color: var(--color-accent); }

  /* contact bar */
  .contact-bar {
    padding: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--sp-5);
    position: relative;
  }
  .contact-bar::before {
    content: "";
    position: absolute; top: -1px; left: -1px;
    width: 16px; height: 16px;
    border-left: 1px solid var(--color-accent);
    border-top: 1px solid var(--color-accent);
  }
  .contact-bar::after {
    content: "";
    position: absolute; bottom: -1px; right: -1px;
    width: 16px; height: 16px;
    border-right: 1px solid var(--color-accent);
    border-bottom: 1px solid var(--color-accent);
  }
  .contact-bar .big {
    font-family: var(--font-display);
    font-size: clamp(24px, 3vw, 40px);
    color: var(--color-fg);
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .contact-bar .big .em {
    color: var(--color-accent);
    text-shadow: 0 0 10px var(--accent-glow);
  }
  .contact-bar .sub { font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 6px; }

  .home-footer {
    border-top: 1px solid var(--color-border);
    padding: var(--sp-8) 0 var(--sp-12);
    margin-top: var(--sp-8);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-8);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .home-footer h3 {
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    margin-bottom: 8px;
    font-weight: 400;
  }
  .home-footer .sources { font-family: var(--font-mono); line-height: 1.8; }
  .home-footer .sources .k { color: var(--color-accent); display: inline-block; width: 100px; }
  .home-footer .sources .v { color: var(--color-fg-dim); }

  /* skeletons */
  @keyframes skel-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  .skel-line { display: block; height: 12px; background: var(--color-bg-raised); border-radius: 2px; margin: 4px 0; animation: skel-pulse 1.4s ease-in-out infinite; }
  .skel-line.short { width: 60%; }
  .skel-box { background: var(--color-bg-raised); animation: skel-pulse 1.4s ease-in-out infinite; }
  .bsky-post.skel { pointer-events: none; }
`;
