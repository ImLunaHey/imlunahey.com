import { Await, getRouteApi, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { Watch, PopfeedData } from '../server/popfeed';

const gamesRoute = getRouteApi('/_main/games/');

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function GamesPage() {
  const { games } = gamesRoute.useLoaderData();

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-games">
        <header className="page-hd">
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              ~/games
            </div>
            <h1>
              games<span className="dot">.</span>
            </h1>
            <p className="sub">
              games reviewed via{' '}
              <a href="https://popfeed.social" target="_blank" rel="noopener noreferrer" className="glow-link">
                popfeed
              </a>
              . rated out of 10.
            </p>
          </div>
          <Await promise={games} fallback={<HeaderCountsSkel />}>
            {(data) => <HeaderCounts data={data} />}
          </Await>
        </header>

        <Await promise={games} fallback={<GridSkel />}>
          {(data) => <Body items={data.items} />}
        </Await>

        <footer className="games-footer">
          <span>
            src: <span className="t-accent">social.popfeed.feed.review · video_game</span>
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

function HeaderCounts({ data }: { data: PopfeedData }) {
  const avg = useMemo(() => {
    const rated = data.items.filter((i) => i.rating != null);
    if (rated.length === 0) return null;
    return rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length;
  }, [data.items]);
  return (
    <div className="counts">
      <div>
        total · <b>{data.items.length}</b>
      </div>
      {data.thisYear > 0 ? (
        <div>
          this year · <b>{data.thisYear}</b>
        </div>
      ) : null}
      {avg != null ? (
        <div>
          avg · <b>{avg.toFixed(1)}</b>
        </div>
      ) : null}
    </div>
  );
}

function HeaderCountsSkel() {
  return (
    <div className="counts">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i}>
          <span className="skel" style={{ display: 'inline-block', width: 80, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

function Body({ items }: { items: Watch[] }) {
  if (items.length === 0) return <div className="empty">no reviews yet.</div>;
  return (
    <div className="review-grid">
      {items.map((g) => (
        <ReviewCard key={g.rkey} g={g} />
      ))}
    </div>
  );
}

function GridSkel() {
  return (
    <div className="review-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="review-card">
          <div className="poster skel" />
          <div className="body">
            <div className="skel" style={{ width: '40%', height: 10, marginBottom: 6 }} />
            <div className="skel" style={{ width: '80%', height: 14, marginBottom: 6 }} />
            <div className="skel" style={{ width: '100%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ g }: { g: Watch }) {
  return (
    <Link to={`/games/${g.rkey}` as never} className="review-card">
      {g.poster ? (
        <div className="poster" style={{ backgroundImage: `url(${g.poster})` }} />
      ) : (
        <div className="poster no-art" />
      )}
      <div className="body">
        <div className="hd">
          <span className="kind">game</span>
          {g.rating != null ? <span className="rating">{g.rating.toFixed(1)}</span> : null}
        </div>
        <div className="title">{g.title}</div>
        {g.credit ? <div className="credit">{g.credit}</div> : null}
        {g.text ? <div className="text">{g.text}</div> : null}
        {g.genres && g.genres.length > 0 ? (
          <div className="genres">
            {g.genres.slice(0, 3).map((gn) => (
              <span key={gn} className="genre">
                {gn.toLowerCase()}
              </span>
            ))}
          </div>
        ) : null}
        <div className="when">{fmtDate(g.createdAt)}</div>
      </div>
    </Link>
  );
}

const CSS = `
  .shell-games { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .empty { padding: 80px 0; text-align: center; color: var(--color-fg-faint); font-size: var(--fs-sm); border: 1px dashed var(--color-border); margin-top: var(--sp-8); }

  .review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--sp-4);
    margin-top: var(--sp-5);
  }
  .review-card {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: inherit;
    text-decoration: none;
  }
  .review-card:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .review-card:hover .title { color: var(--color-accent); }
  .review-card .poster { aspect-ratio: 3/4; background-size: cover; background-position: center; border: 1px solid var(--color-border); }
  .review-card .poster.no-art { background: var(--color-bg-raised); background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .review-card .body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .review-card .hd { display: flex; gap: var(--sp-2); align-items: center; font-size: var(--fs-xs); }
  .review-card .kind { color: var(--color-accent); border: 1px solid var(--color-accent-dim); text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-mono); padding: 1px 5px; }
  .review-card .rating { color: var(--color-accent); font-family: var(--font-mono); font-weight: 500; }
  .review-card .title { font-size: var(--fs-md); color: var(--color-fg); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .review-card .credit { font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
  .review-card .text { font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 4px; }
  .review-card .genres { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
  .review-card .genre { font-size: 10px; color: var(--color-fg-faint); font-family: var(--font-mono); padding: 1px 5px; border: 1px solid var(--color-border); }
  .review-card .when { font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); margin-top: auto; }
  .review-card .poster.skel { background-image: none; }

  .games-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
