import { Link, useParams } from '@tanstack/react-router';
import LIBRARY from '../data/library.json';
import { useTheMovieDBDetail } from '../hooks/use-themoviedb-detail';

type LibraryItem = (typeof LIBRARY)[number];

const TMDB_IMG = 'https://image.tmdb.org/t/p';

function imgUrl(path: string | null, size: string): string | null {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

export default function LibraryDetailPage() {
  const { imdbId } = useParams({ from: '/_main/library/$imdbId' });

  // Same imdbId can appear on multiple rows (one item per physical
  // edition). The detail page is about the title — show shared metadata
  // once, then list all the editions you own further down.
  const editions = LIBRARY.filter((it) => it.imdbId === imdbId);
  const item: LibraryItem | undefined = editions[0];

  const tmdb = useTheMovieDBDetail(item?.mediaType ?? null, item?.tmdbId ?? null);

  if (!item) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-libd">
          <div className="not-found">
            <p className="t-faint">no library entry for {imdbId}</p>
            <Link to="/library" className="t-accent">← back to library</Link>
          </div>
        </main>
      </>
    );
  }

  const poster = imgUrl(item.posterPath, 'w500');
  const backdrop = imgUrl(tmdb.data?.backdropPath ?? null, 'w1280');

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-libd">
        {backdrop ? (
          <div className="hero">
            <img src={backdrop} alt="" className="hero-img" />
            <div className="hero-fade" aria-hidden="true" />
          </div>
        ) : null}

        <div className="lead">
          <div className="lead-poster">
            {poster ? (
              <img src={poster} alt={item.title} />
            ) : (
              <div className="poster-fallback">{item.title}</div>
            )}
          </div>
          <div className="lead-meta">
            <Link to="/library" className="back-link">← /library</Link>
            <h1>{item.title}</h1>
            {tmdb.data?.tagline ? <p className="tagline">{tmdb.data.tagline}</p> : null}
            <div className="facts">
              {item.releaseYear ? <span>{item.releaseYear}</span> : null}
              {item.director ? (
                <>
                  <span className="dot">·</span>
                  <span>dir <b className="t-fg">{item.director}</b></span>
                </>
              ) : null}
              {item.runtime ? (
                <>
                  <span className="dot">·</span>
                  <span>{item.runtime} min</span>
                </>
              ) : null}
              {item.countries.length > 0 ? (
                <>
                  <span className="dot">·</span>
                  <span>{item.countries.join(' · ')}</span>
                </>
              ) : null}
            </div>
            {item.genres.length > 0 ? (
              <div className="genres">
                {item.genres.map((g) => (
                  <span key={g} className="genre">{g.toLowerCase()}</span>
                ))}
              </div>
            ) : null}
            {item.overview ? <p className="overview">{item.overview}</p> : null}
          </div>
        </div>

        {/* physical editions you own */}
        <section className="section">
          <h2 className="section-hd">
            <span className="num">01 //</span>on the shelf.
          </h2>
          <div className="editions">
            {editions.map((e) => (
              <div key={e.id} className="edition">
                <div className="edition-format">{e.format}</div>
                <div className="edition-meta">
                  {e.distributor ? (
                    <div className="edition-dist">{e.distributor}</div>
                  ) : (
                    <div className="edition-dist t-faint">—</div>
                  )}
                  <div className="edition-added t-faint">added {e.addedDate}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* cast — fetched lazily from tmdb */}
        {tmdb.isLoading ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">02 //</span>cast.
            </h2>
            <div className="cast-loading t-faint">loading cast from tmdb…</div>
          </section>
        ) : tmdb.data && tmdb.data.cast.length > 0 ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">02 //</span>cast.
            </h2>
            <div className="cast-grid">
              {tmdb.data.cast.map((c) => (
                <div key={c.id} className="cast-card">
                  <div className="cast-photo">
                    {c.profilePath ? (
                      <img src={imgUrl(c.profilePath, 'w185') ?? ''} alt={c.name} loading="lazy" />
                    ) : (
                      <div className="cast-photo-fallback">{c.name.slice(0, 2)}</div>
                    )}
                  </div>
                  <div className="cast-name">{c.name}</div>
                  {c.character ? (
                    <div className="cast-role t-faint">{c.character}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="libd-footer">
          <span>
            src:{' '}
            <span className="t-accent">
              clz · tmdb · imdb {item.imdbId}
            </span>
          </span>
          <span>
            ←{' '}
            <Link to="/library" className="t-accent">
              library
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-libd { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  /* hero — backdrop bleeds behind the lead block, fading into bg */
  .hero {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 480px;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .hero-img {
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0.18;
    filter: saturate(0.6);
  }
  .hero-fade {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0,
      transparent 40%,
      var(--color-bg) 100%
    );
  }

  .lead {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--sp-6);
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .lead-poster {
    aspect-ratio: 2 / 3;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .lead-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .poster-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: var(--sp-3);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .lead-meta { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
  .back-link {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-decoration: none;
  }
  .back-link:hover { color: var(--color-accent); text-decoration: none; }
  .lead-meta h1 {
    font-family: var(--font-display);
    font-size: clamp(36px, 5vw, 64px);
    font-weight: 500; letter-spacing: -0.02em; line-height: 1.05;
    color: var(--color-fg);
    margin: 0;
  }
  .tagline {
    color: var(--color-fg-dim);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    font-style: italic;
  }
  .facts {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .facts b.t-fg { color: var(--color-fg); font-weight: 400; }
  .facts .dot { color: var(--color-fg-ghost); }
  .genres { display: flex; gap: 4px; flex-wrap: wrap; }
  .genre {
    padding: 2px 8px;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    font-family: var(--font-mono); font-size: 10px;
    text-transform: lowercase; letter-spacing: 0.06em;
  }
  .overview {
    color: var(--color-fg-dim);
    line-height: 1.55;
    margin-top: var(--sp-2);
  }

  .section {
    position: relative; z-index: 1;
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .section-hd {
    font-family: var(--font-display);
    font-size: 24px; font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    margin-bottom: var(--sp-4);
  }
  .section-hd .num {
    color: var(--color-accent);
    font-family: var(--font-mono); font-size: 13px;
    margin-right: 12px;
    letter-spacing: 0.08em;
  }

  /* on-the-shelf editions */
  .editions {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--sp-3);
  }
  .edition {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: var(--sp-2);
  }
  .edition-format {
    font-family: var(--font-display); font-size: 18px;
    color: var(--color-accent);
    text-shadow: 0 0 8px var(--accent-glow);
  }
  .edition-meta { font-family: var(--font-mono); font-size: var(--fs-xs); }
  .edition-dist { color: var(--color-fg); }
  .edition-added { font-size: 10px; }

  /* cast */
  .cast-loading {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: var(--sp-3) 0;
  }
  .cast-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--sp-3) var(--sp-2);
  }
  .cast-card { display: flex; flex-direction: column; gap: 6px; }
  .cast-photo {
    aspect-ratio: 1 / 1;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .cast-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cast-photo-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-fg-faint);
    font-family: var(--font-display); font-size: 24px;
    text-transform: lowercase;
  }
  .cast-name {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .cast-role {
    font-family: var(--font-mono); font-size: 10px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .libd-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  .not-found {
    padding: 120px 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .not-found .t-accent { display: inline-block; margin-top: var(--sp-3); }

  @media (max-width: 760px) {
    .lead { grid-template-columns: 1fr; }
    .lead-poster { max-width: 220px; }
    .libd-footer { flex-direction: column; gap: var(--sp-3); }
    .editions { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
    .cast-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
  }
`;
