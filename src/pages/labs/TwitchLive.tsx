import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getPreferredLang, getTopGames, getTopStreams, searchCategories, type Game, type Stream } from '../../server/twitch';

/**
 * Top live streams on Twitch right now. Goes through a server proxy
 * (src/server/twitch.ts) so the Client Secret stays server-side.
 *
 * URL state: ?game=<game_id>&lang=<iso639-1>
 * Auto-refreshes every 60s; paginates via Helix cursor.
 */

const REFRESH_MS = 60_000;

const LANGS: Array<{ code: string; label: string }> = [
  { code: '', label: 'all' },
  { code: 'en', label: 'en' },
  { code: 'ja', label: 'ja' },
  { code: 'ko', label: 'ko' },
  { code: 'es', label: 'es' },
  { code: 'de', label: 'de' },
  { code: 'fr', label: 'fr' },
  { code: 'ru', label: 'ru' },
  { code: 'pt', label: 'pt' },
  { code: 'zh', label: 'zh' },
];

function thumbnail(url: string, width: number, height: number): string {
  return url.replace('{width}', String(width)).replace('{height}', String(height));
}

function boxArt(url: string, width: number, height: number): string {
  return url.replace('{width}', String(width)).replace('{height}', String(height));
}

function fmtViewers(n: number): string {
  if (n >= 10_000) return (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

function fmtDuration(startedAt: string): string {
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TwitchLivePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { game?: string; lang?: string };
  const gameId = search.game ?? '';
  const language = search.lang ?? '';
  const langInitialised = useRef(false);

  // On first mount, if the URL has no explicit lang, resolve the browser's
  // preferred language (from the ssr request's Accept-Language) and push it
  // into the URL. `lang` param being present — even empty — suppresses the
  // auto-pick, so "all languages" is a sticky user choice.
  useEffect(() => {
    if (langInitialised.current) return;
    langInitialised.current = true;
    if (search.lang !== undefined) return;
    getPreferredLang().then((r) => {
      if (!r.lang) return;
      navigate({ to: '/labs/twitch-live' as never, search: { game: gameId || undefined, lang: r.lang } as never, replace: true });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [streams, setStreams] = useState<Stream[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState('');
  const [gameName, setGameName] = useState('');

  const refresh = async (signal?: AbortSignal) => {
    setErr('');
    setLoading(true);
    try {
      const r = await getTopStreams({ data: { gameId: gameId || undefined, language: language || undefined, first: 48 } });
      if (signal?.aborted) return;
      setStreams(r.data);
      setCursor(r.pagination.cursor);
    } catch (e) {
      if (!signal?.aborted) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // primary effect: fetch streams whenever filters change; polls every 60s
  useEffect(() => {
    const ctl = new AbortController();
    void refresh(ctl.signal);
    const id = setInterval(() => void refresh(ctl.signal), REFRESH_MS);
    return () => { ctl.abort(); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, language]);

  // secondary effect: resolve the game name when filtering by game id.
  // We already have game_name on stream rows, so pull it from the first
  // live stream — saves a lookup round-trip when possible.
  useEffect(() => {
    if (!gameId) { setGameName(''); return; }
    const match = streams.find((s) => s.game_id === gameId);
    if (match) setGameName(match.game_name);
  }, [gameId, streams]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await getTopStreams({ data: { gameId: gameId || undefined, language: language || undefined, first: 48, after: cursor } });
      setStreams((prev) => [...prev, ...r.data]);
      setCursor(r.pagination.cursor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const setLang = (code: string) => {
    navigate({ to: '/labs/twitch-live' as never, search: { game: gameId || undefined, lang: code || undefined } as never });
  };
  const setGame = (id: string | undefined) => {
    navigate({ to: '/labs/twitch-live' as never, search: { game: id, lang: language || undefined } as never });
  };

  const totalViewers = streams.reduce((acc, s) => acc + s.viewer_count, 0);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tw">
        <header className="page-hd">
          <div className="label">~/labs/twitch-live</div>
          <h1>twitch live<span className="dot">.</span></h1>
          <p className="sub">
            top live streams on twitch right now, via the helix api. filter by game or language.
            auto-refreshes every minute.
          </p>
        </header>

        <section className="controls">
          <div className="ctl-row">
            <span className="k">language</span>
            <div className="chips">
              {LANGS.map((l) => (
                <button
                  key={l.code || 'all'}
                  type="button"
                  className={'chip' + (language === l.code ? ' active' : '')}
                  onClick={() => setLang(l.code)}
                >{l.label}</button>
              ))}
            </div>
          </div>
          <div className="ctl-row">
            <span className="k">game</span>
            <GamePicker
              currentId={gameId}
              currentName={gameName}
              onPick={(g) => { setGame(g?.id); if (g) setGameName(g.name); }}
            />
          </div>
        </section>

        {err ? <div className="err">{err}</div> : null}

        <section className="stats">
          <div className="stat"><span className="k">streams</span><b>{streams.length.toLocaleString()}</b></div>
          <div className="stat"><span className="k">combined viewers</span><b>{fmtViewers(totalViewers)}</b></div>
          <div className="stat"><span className="k">filter</span><b>{gameName || (gameId ? `id ${gameId}` : 'any game')} · {language || 'any lang'}</b></div>
        </section>

        {loading && streams.length === 0 ? <div className="loading">fetching live streams…</div> : null}

        {!loading && streams.length === 0 && !err ? (
          <div className="empty">no streams match that filter right now.</div>
        ) : null}

        <section className="grid">
          {streams.map((s) => (
            <Link
              key={s.id}
              className="stream"
              to={'/labs/twitch-live/$login' as never}
              params={{ login: s.user_login } as never}
            >
              <div className="s-thumb">
                <img src={thumbnail(s.thumbnail_url, 440, 248)} alt="" loading="lazy" />
                <span className="s-live">LIVE</span>
                <span className="s-viewers">{fmtViewers(s.viewer_count)}</span>
                <span className="s-dur">{fmtDuration(s.started_at)}</span>
              </div>
              <div className="s-body">
                <div className="s-name">{s.user_name}</div>
                <div className="s-title" title={s.title}>{s.title}</div>
                <div className="s-game">
                  <button type="button" className="s-game-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGame(s.game_id); }}>
                    {s.game_name || '—'}
                  </button>
                  {s.language ? <span className="s-lang">{s.language}</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </section>

        {cursor ? (
          <div className="more">
            <button type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'loading…' : 'load more ↓'}
            </button>
          </div>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.twitch.tv/helix</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function GamePicker({
  currentId,
  currentName,
  onPick,
}: {
  currentId: string;
  currentName: string;
  onPick: (game: Game | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [top, setTop] = useState<Game[]>([]);
  const [hits, setHits] = useState<Game[]>([]);
  const [open, setOpen] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    getTopGames({ data: { first: 12 } }).then((r) => setTop(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setHits([]); return; }
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      searchCategories({ data: { q: query.trim() } }).then((r) => {
        if (seq !== searchSeq.current) return;
        setHits(r.data);
      }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const shown = query.trim() ? hits : top;

  return (
    <div className={'gp' + (open ? ' open' : '')}>
      <div className="gp-current">
        {currentId ? (
          <>
            <span className="gp-label">{currentName || `id ${currentId}`}</span>
            <button type="button" className="gp-clear" onClick={() => onPick(null)} aria-label="clear game filter">×</button>
          </>
        ) : <span className="gp-empty">any game</span>}
        <button type="button" className="gp-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? 'close' : 'change…'}
        </button>
      </div>
      {open ? (
        <div className="gp-panel">
          <input
            className="gp-search"
            type="text"
            placeholder="search games / categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="gp-grid">
            {shown.map((g) => (
              <button
                key={g.id}
                type="button"
                className={'gp-cell' + (g.id === currentId ? ' active' : '')}
                onClick={() => { onPick(g); setOpen(false); setQuery(''); }}
              >
                <img src={boxArt(g.box_art_url, 70, 93)} alt="" loading="lazy" />
                <span>{g.name}</span>
              </button>
            ))}
            {shown.length === 0 && query.trim() ? <div className="gp-empty-grid">no matches</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const CSS = `
  .shell-tw { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .controls { margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .ctl-row { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
  .k { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; min-width: 72px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 4px 10px; font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .chip:hover:not(.active) { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .chip.active { background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); min-width: 0; }
  .stat .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

  .loading, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); line-height: 1.55; }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .grid { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--sp-3); }
  .stream { display: flex; flex-direction: column; text-decoration: none; color: inherit; border: 1px solid var(--color-border); background: var(--color-bg-panel); overflow: hidden; transition: border-color 120ms ease, transform 120ms ease; }
  .stream:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .s-thumb { position: relative; aspect-ratio: 16 / 9; background: var(--color-bg-raised); }
  .s-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .s-live { position: absolute; top: 6px; left: 6px; background: #e91916; color: #fff; font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; letter-spacing: 0.1em; }
  .s-viewers { position: absolute; top: 6px; right: 6px; background: color-mix(in oklch, black 70%, transparent); color: var(--color-fg); font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; }
  .s-dur { position: absolute; bottom: 6px; right: 6px; background: color-mix(in oklch, black 70%, transparent); color: var(--color-fg); font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; }
  .s-body { padding: var(--sp-2) var(--sp-3); display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); min-width: 0; }
  .s-name { color: var(--color-fg); font-family: var(--font-display); letter-spacing: -0.01em; font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s-title { color: var(--color-fg-dim); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
  .s-game { display: flex; align-items: center; gap: var(--sp-2); color: var(--color-fg-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }
  .s-game-link { background: transparent; border: 0; padding: 0; color: var(--color-fg-faint); cursor: pointer; font-family: inherit; font-size: inherit; text-transform: inherit; letter-spacing: inherit; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .s-game-link:hover { color: var(--color-accent); }
  .s-lang { border: 1px solid var(--color-border); padding: 0 6px; color: var(--color-fg-faint); flex-shrink: 0; }

  .more { margin-top: var(--sp-5); display: flex; justify-content: center; }
  .more button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 10px var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .more button:hover:not([disabled]) { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .more button[disabled] { opacity: 0.5; cursor: not-allowed; }

  .gp { flex: 1; min-width: 0; position: relative; }
  .gp-current { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
  .gp-label { border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); padding: 4px 10px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); }
  .gp-empty { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .gp-clear { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-faint); cursor: pointer; width: 22px; height: 22px; padding: 0; font-size: 14px; line-height: 1; }
  .gp-clear:hover { color: var(--color-alert); border-color: var(--color-alert); }
  .gp-toggle { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 4px 10px; font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .gp-toggle:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .gp-panel { margin-top: var(--sp-2); border: 1px solid var(--color-border); background: var(--color-bg); padding: var(--sp-3); }
  .gp-search { width: 100%; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); padding: 8px var(--sp-3); outline: 0; }
  .gp-search:focus { border-color: var(--color-accent-dim); }
  .gp-grid { margin-top: var(--sp-3); display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--sp-2); }
  .gp-cell { background: transparent; border: 1px solid var(--color-border); padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; align-items: center; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: 10px; text-align: center; }
  .gp-cell img { width: 70px; height: 93px; object-fit: cover; background: var(--color-bg-raised); display: block; }
  .gp-cell:hover, .gp-cell.active { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .gp-empty-grid { grid-column: 1 / -1; text-align: center; padding: var(--sp-4); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
