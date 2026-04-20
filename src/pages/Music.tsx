import { Await, getRouteApi, Link } from '@tanstack/react-router';
import { LASTFM_PROFILE_URL, type LastFmTrack, type MusicData } from '../server/lastfm';

const musicRoute = getRouteApi('/_main/music');

function fmtRel(iso: string | null): string {
  if (!iso) return 'now';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2_592_000) return `${Math.floor(diff / 86_400)}d ago`;
  return iso.slice(0, 10);
}

export default function MusicPage() {
  const { music } = musicRoute.useLoaderData();

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-music">
        <header className="page-hd">
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              ~/music
            </div>
            <h1>
              music<span className="dot">.</span>
            </h1>
            <p className="sub">
              scrobbles from{' '}
              <a href={LASTFM_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="glow-link">
                last.fm
              </a>
              .
            </p>
          </div>
          <Await promise={music} fallback={<HeaderCountsSkel />}>
            {(data) => <HeaderCounts data={data} />}
          </Await>
        </header>

        <Await promise={music} fallback={<BodySkel />}>
          {(data) => <Body data={data} />}
        </Await>

        <footer className="music-footer">
          <span>
            src: <span className="t-accent">ws.audioscrobbler.com</span>
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

function HeaderCounts({ data }: { data: MusicData }) {
  const nowPlaying = data.tracks.some((t) => t.nowPlaying);
  return (
    <div className="counts">
      <div>
        total scrobbles · <b>{data.total.toLocaleString()}</b>
      </div>
      <div>
        in feed · <b>{data.tracks.length}</b>
      </div>
      {nowPlaying ? (
        <div>
          status · <b className="live">● live</b>
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
          <span className="skel" style={{ display: 'inline-block', width: 120, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

function Body({ data }: { data: MusicData }) {
  const nowPlaying = data.tracks.find((t) => t.nowPlaying);
  const history = data.tracks.filter((t) => !t.nowPlaying);

  if (data.tracks.length === 0) {
    return <div className="empty">no scrobbles yet. (set LASTFM_API_KEY if running locally.)</div>;
  }

  return (
    <>
      {nowPlaying ? (
        <section className="now-panel">
          <div className="now-label">
            <span className="live-dot" />
            now playing
          </div>
          <a className="now-body" href={nowPlaying.url} target="_blank" rel="noopener noreferrer">
            {nowPlaying.art ? <img src={nowPlaying.art} alt="" className="now-art" /> : <div className="now-art" />}
            <div className="now-meta">
              <div className="now-track">{nowPlaying.track}</div>
              <div className="now-artist">{nowPlaying.artist}</div>
              {nowPlaying.album ? <div className="now-album">{nowPlaying.album}</div> : null}
            </div>
          </a>
        </section>
      ) : null}

      <section className="history">
        <div className="history-head">── history</div>
        {history.map((t: LastFmTrack, i: number) => (
          <a
            key={`${t.url}-${t.ts ?? i}`}
            className="row"
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.art ? <img src={t.art} alt="" className="art" loading="lazy" /> : <div className="art no-art" />}
            <div className="row-meta">
              <div className="r-track">{t.track}</div>
              <div className="r-artist">{t.artist}</div>
            </div>
            <div className="r-album">{t.album}</div>
            <div className="r-when" suppressHydrationWarning>{fmtRel(t.ts)}</div>
          </a>
        ))}
      </section>
    </>
  );
}

function BodySkel() {
  return (
    <section className="history">
      <div className="history-head">── history</div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="row">
          <div className="skel art" style={{ backgroundImage: 'none' }} />
          <div className="row-meta">
            <div className="skel" style={{ width: '60%', height: 10, marginBottom: 4 }} />
            <div className="skel" style={{ width: '40%', height: 10 }} />
          </div>
          <div className="skel" style={{ width: '100%', height: 10 }} />
          <div className="skel" style={{ width: 40, height: 10 }} />
        </div>
      ))}
    </section>
  );
}

const CSS = `
  .shell-music { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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
  .page-hd .counts b.live { color: var(--color-accent); animation: pulse 1.4s ease-in-out infinite; }

  .empty { padding: 80px 0; text-align: center; color: var(--color-fg-faint); font-size: var(--fs-sm); border: 1px dashed var(--color-border); margin-top: var(--sp-8); font-family: var(--font-mono); }

  .now-panel {
    margin: var(--sp-6) 0;
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
    padding: var(--sp-5);
  }
  .now-label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.12em; display: flex; align-items: center; gap: 8px; margin-bottom: var(--sp-3); }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.45 } }
  .now-body { display: flex; gap: var(--sp-4); align-items: center; color: inherit; text-decoration: none; }
  .now-body:hover { text-decoration: none; }
  .now-body:hover .now-track { color: var(--color-accent); }
  .now-art { width: 96px; height: 96px; object-fit: cover; border: 1px solid var(--color-border); background: var(--color-bg-raised); }
  .now-meta { min-width: 0; flex: 1; }
  .now-track { font-size: var(--fs-xl); color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .now-artist { font-size: var(--fs-md); color: var(--color-fg-dim); }
  .now-album { font-size: var(--fs-sm); color: var(--color-fg-faint); margin-top: 4px; }

  .history { margin-top: var(--sp-5); border-top: 1px solid var(--color-border); }
  .history-head { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); padding: var(--sp-4) 0 var(--sp-3); letter-spacing: 0.1em; }

  .row {
    display: grid;
    grid-template-columns: 48px minmax(0, 1.5fr) minmax(0, 1fr) 80px;
    gap: var(--sp-3);
    align-items: center;
    padding: 6px 8px;
    border-bottom: 1px dashed var(--color-border);
    color: inherit;
    text-decoration: none;
    font-size: var(--fs-sm);
  }
  .row:hover { background: var(--color-bg-raised); text-decoration: none; }
  .row:hover .r-track { color: var(--color-accent); }
  .row .art { width: 40px; height: 40px; object-fit: cover; border: 1px solid var(--color-border); background: var(--color-bg-raised); }
  .row .art.no-art { background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .row-meta { min-width: 0; }
  .r-track { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r-artist { color: var(--color-fg-dim); font-size: var(--fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r-album { color: var(--color-fg-faint); font-size: var(--fs-xs); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r-when { color: var(--color-fg-faint); font-size: var(--fs-xs); font-family: var(--font-mono); text-align: right; }

  .music-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }

  @media (max-width: 640px) {
    .page-hd { grid-template-columns: 1fr; }
    .page-hd .counts { text-align: left; }
    .row { grid-template-columns: 40px minmax(0, 1fr) 60px; }
    .r-album { display: none; }
  }
`;
