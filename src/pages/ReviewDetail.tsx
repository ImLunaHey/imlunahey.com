import { getRouteApi, Link, Navigate, useParams } from '@tanstack/react-router';

type Kind = 'watch' | 'game';

const KIND_ROUTE = {
  watch: '/_main/watching/$rkey',
  game: '/_main/games/$rkey',
} as const;

function kindLabel(kind: string): string {
  if (kind === 'movie') return 'movie';
  if (kind === 'tv_show' || kind === 'tvShow') return 'tv show';
  if (kind === 'episode') return 'episode';
  if (kind === 'video_game' || kind === 'videoGame' || kind === 'game') return 'game';
  return kind;
}

export default function ReviewDetailPage({ kind, backTo }: { kind: Kind; backTo: string }) {
  const route = getRouteApi(KIND_ROUTE[kind]);
  const { items } = route.useLoaderData();
  const params = useParams({ strict: false }) as { rkey?: string };
  const item = items.find((i) => i.rkey === params.rkey);

  if (!item) return <Navigate to={'/not-found' as never} replace />;

  return (
    <>
      <style>{CSS}</style>
      {item.backdrop ? (
        <div className="hero-bg" style={{ backgroundImage: `url(${item.backdrop})` }} />
      ) : null}
      <main className="shell-review">
        <div className="crumbs">
          <Link to={backTo as never} className="t-accent">
            ← {backTo.replace(/^\//, '/')}
          </Link>
        </div>

        <article className="review">
          {item.poster ? (
            <img className="poster" src={item.poster} alt="" />
          ) : (
            <div className="poster no-art" />
          )}
          <div className="meta">
            <div className="kind-chip">{kindLabel(item.kind)}</div>
            <h1>{item.title}</h1>
            <div className="facts">
              {item.rating != null ? (
                <span className="rating">
                  ★ <b>{item.rating.toFixed(1)}</b> / 10
                </span>
              ) : null}
              {item.credit ? (
                <span className="credit">
                  by <b>{item.credit}</b>
                </span>
              ) : null}
              <span className="date">reviewed {item.createdAt.slice(0, 10)}</span>
            </div>
            {item.genres && item.genres.length > 0 ? (
              <div className="genres">
                {item.genres.map((g) => (
                  <span key={g} className="genre">
                    {g.toLowerCase()}
                  </span>
                ))}
              </div>
            ) : null}
            {item.url ? (
              <a className="ext" href={item.url} target="_blank" rel="noopener noreferrer">
                view on tmdb ↗
              </a>
            ) : null}
          </div>
        </article>

        {item.text ? (
          <section className="body">
            <div className="body-label">── review</div>
            <p className="body-text">{item.text}</p>
          </section>
        ) : null}

        <footer className="review-footer">
          <span>
            src: <span className="t-accent">social.popfeed.feed.review</span>
          </span>
          <Link to={backTo as never} className="t-accent">
            ← back
          </Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .hero-bg {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 420px;
    background-size: cover;
    background-position: center;
    opacity: 0.25;
    mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
    z-index: -1;
    pointer-events: none;
  }

  .shell-review {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--sp-6);
    position: relative;
  }

  .crumbs { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-5); padding-top: var(--sp-4); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); text-decoration: none; }

  .review {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--sp-6);
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .review .poster {
    width: 220px;
    aspect-ratio: 2/3;
    object-fit: cover;
    border: 1px solid var(--color-border);
    background: var(--color-bg-raised);
  }
  .review .poster.no-art { background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .review .meta { min-width: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
  .review .kind-chip {
    display: inline-block;
    align-self: flex-start;
    padding: 2px 8px;
    border: 1px solid var(--color-accent-dim);
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .review h1 {
    font-family: var(--font-display);
    font-size: clamp(32px, 5vw, 56px);
    font-weight: 500;
    line-height: 1;
    color: var(--color-fg);
  }
  .review .facts {
    display: flex;
    gap: var(--sp-4);
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
  }
  .review .facts b { color: var(--color-accent); font-weight: 400; }
  .review .facts .rating b { font-size: var(--fs-md); }
  .review .genres { display: flex; gap: 6px; flex-wrap: wrap; }
  .review .genre {
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    color: var(--color-fg-faint);
    padding: 2px 8px;
    border: 1px solid var(--color-border);
  }
  .review .ext {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-accent);
    text-decoration: none;
    align-self: flex-start;
    padding: 4px 10px;
    border: 1px solid var(--color-accent-dim);
  }
  .review .ext:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); text-decoration: none; }

  .body { padding: var(--sp-6) 0; }
  .body-label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-3); }
  .body-text {
    color: var(--color-fg);
    font-size: var(--fs-md);
    line-height: 1.7;
    white-space: pre-wrap;
    max-width: 68ch;
  }

  .review-footer {
    display: flex;
    justify-content: space-between;
    padding: var(--sp-6) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
  }

  @media (max-width: 640px) {
    .review { grid-template-columns: 1fr; }
    .review .poster { width: 160px; }
  }
`;
