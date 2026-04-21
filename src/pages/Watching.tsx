import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { getPopfeedWatches, type Watch, type PopfeedData } from '../server/popfeed';

type Filter = 'all' | 'movie' | 'tv_show';

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function kindLabel(kind: string): string {
  if (kind === 'tv_show' || kind === 'tvShow') return 'tv';
  if (kind === 'episode') return 'ep';
  return kind;
}

const isTv = (k: string) => k === 'tv_show' || k === 'tvShow' || k === 'episode';

export default function WatchingPage() {
  const { data: watches } = useQuery({ queryKey: ['popfeed', 'watches'], queryFn: () => getPopfeedWatches() });

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-watching">
        <header className="page-hd">
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              ~/watching
            </div>
            <h1>
              watching<span className="dot">.</span>
            </h1>
            <p className="sub">
              reviews pulled from{' '}
              <a href="https://popfeed.social" target="_blank" rel="noopener noreferrer" className="glow-link">
                popfeed
              </a>
              . movies, tv, and the occasional episode — rated out of 10.
            </p>
          </div>
          {watches ? <HeaderCounts data={watches} /> : <HeaderCountsSkel />}
        </header>

        {watches ? <Body items={watches.items} /> : <GridSkel />}

        <footer className="watching-footer">
          <span>
            src: <span className="t-accent">social.popfeed.feed.review</span>
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
  const { items, thisYear } = data;
  const avg = useMemo(() => {
    const rated = items.filter((i) => i.rating != null);
    if (rated.length === 0) return null;
    return rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length;
  }, [items]);
  const counts = useMemo(() => {
    let movies = 0;
    let tv = 0;
    for (const i of items) {
      if (i.kind === 'movie') movies++;
      else if (isTv(i.kind)) tv++;
    }
    return { movies, tv };
  }, [items]);

  return (
    <div className="counts">
      <div>
        total · <b>{items.length}</b>
      </div>
      <div>
        movies · <b>{counts.movies}</b>
      </div>
      <div>
        tv · <b>{counts.tv}</b>
      </div>
      <div>
        this year · <b>{thisYear}</b>
      </div>
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
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <span className="skel" style={{ display: 'inline-block', width: 80, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

function Body({ items }: { items: Watch[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const filtered =
    filter === 'all'
      ? items
      : filter === 'movie'
        ? items.filter((i) => i.kind === 'movie')
        : items.filter((i) => isTv(i.kind));
  const counts = useMemo(() => {
    let movies = 0;
    let tv = 0;
    for (const i of items) {
      if (i.kind === 'movie') movies++;
      else if (isTv(i.kind)) tv++;
    }
    return { all: items.length, movie: movies, tv_show: tv };
  }, [items]);

  if (items.length === 0) return <div className="empty">no reviews yet.</div>;

  return (
    <>
      <nav className="tabs">
        {(['all', 'movie', 'tv_show'] as const).map((k) => (
          <button key={k} className={'tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)} type="button">
            {k === 'all' ? 'all' : k === 'movie' ? 'movies' : 'tv'}
            <span className="n">{counts[k]}</span>
          </button>
        ))}
      </nav>

      <div className="review-grid">
        {filtered.map((w) => (
          <ReviewCard key={w.rkey} w={w} />
        ))}
      </div>
    </>
  );
}

function GridSkel() {
  return (
    <div className="review-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="review-card skel-card">
          <div className="poster skel" />
          <div className="body">
            <div className="skel" style={{ width: '40%', height: 10, marginBottom: 6 }} />
            <div className="skel" style={{ width: '80%', height: 14, marginBottom: 6 }} />
            <div className="skel" style={{ width: '100%', height: 10, marginBottom: 4 }} />
            <div className="skel" style={{ width: '70%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ w }: { w: Watch }) {
  const inner = (
    <>
      {w.poster ? (
        <div className="poster" style={{ backgroundImage: `url(${w.poster})` }} />
      ) : (
        <div className="poster no-art" />
      )}
      <div className="body">
        <div className="hd">
          <span className={`kind ${w.kind}`}>{kindLabel(w.kind)}</span>
          {w.rating != null ? <span className="rating">{w.rating.toFixed(1)}</span> : null}
        </div>
        <div className="title">{w.title}</div>
        {w.credit ? <div className="credit">{w.credit}</div> : null}
        {w.text ? <div className="text">{w.text}</div> : null}
        {w.genres && w.genres.length > 0 ? (
          <div className="genres">
            {w.genres.slice(0, 3).map((g) => (
              <span key={g} className="genre">
                {g.toLowerCase()}
              </span>
            ))}
          </div>
        ) : null}
        <div className="when">{fmtDate(w.createdAt)}</div>
      </div>
    </>
  );

  return (
    <Link to={`/watching/${w.rkey}` as never} className="review-card">
      {inner}
    </Link>
  );
}

const CSS = `
  .shell-watching { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .tabs { display: flex; gap: 2px; padding: var(--sp-5) 0 var(--sp-3); border-bottom: 1px solid var(--color-border); overflow-x: auto; }
  .tab { padding: 6px 14px; border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); cursor: pointer; font-family: var(--font-mono); font-size: var(--fs-sm); }
  .tab:hover { border-color: var(--color-border-bright); color: var(--color-fg); }
  .tab.on { border-color: var(--color-accent-dim); color: var(--color-accent); background: var(--color-bg-raised); }
  .tab .n { color: var(--color-fg-faint); margin-left: 6px; font-size: var(--fs-xs); }
  .tab.on .n { color: var(--color-accent-faint); }

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
  .review-card .poster { aspect-ratio: 2/3; background-size: cover; background-position: center; border: 1px solid var(--color-border); }
  .review-card .poster.no-art { background: var(--color-bg-raised); background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .review-card .body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .review-card .hd { display: flex; gap: var(--sp-2); align-items: center; font-size: var(--fs-xs); }
  .review-card .kind { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-mono); padding: 1px 5px; border: 1px solid var(--color-border-bright); }
  .review-card .kind.movie { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .review-card .rating { color: var(--color-accent); font-family: var(--font-mono); font-weight: 500; }
  .review-card .title { font-size: var(--fs-md); color: var(--color-fg); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .review-card .credit { font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
  .review-card .text { font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 4px; }
  .review-card .genres { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
  .review-card .genre { font-size: 10px; color: var(--color-fg-faint); font-family: var(--font-mono); padding: 1px 5px; border: 1px solid var(--color-border); }
  .review-card .when { font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); margin-top: auto; }
  .review-card.skel-card { pointer-events: none; }
  .review-card .poster.skel { background-image: none; }

  .watching-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;
