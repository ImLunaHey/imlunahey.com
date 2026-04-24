import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

/**
 * TVmaze — api.tvmaze.com — open tv metadata + daily schedule. No key,
 * permissive CORS, complete coverage of major english-language tv plus
 * most european channels.
 *
 * Two modes:
 *   schedule · what's airing on a given date in a given country
 *   search   · find a show by name
 */

const API = 'https://api.tvmaze.com';

type Show = {
  id: number;
  name: string;
  type?: string;
  language?: string;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string;
  ended?: string;
  officialSite?: string | null;
  rating?: { average: number | null };
  network?: { id: number; name: string; country?: { name: string; code: string } } | null;
  webChannel?: { id: number; name: string } | null;
  image?: { medium: string; original: string } | null;
  summary?: string;
  url?: string;
};

type ScheduleEntry = {
  id: number;
  name: string; // episode title
  season: number;
  number: number | null;
  airdate: string;
  airtime: string;
  airstamp: string;
  runtime: number | null;
  show: Show;
};

type SearchHit = { score: number; show: Show };

async function fetchSchedule(country: string, date: string): Promise<ScheduleEntry[]> {
  const url = new URL(`${API}/schedule`);
  url.searchParams.set('country', country);
  url.searchParams.set('date', date);
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  return (await r.json()) as ScheduleEntry[];
}

async function searchShows(q: string): Promise<Show[]> {
  const url = new URL(`${API}/search/shows`);
  url.searchParams.set('q', q);
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const j = (await r.json()) as SearchHit[];
  return j.map((h) => h.show);
}

function stripHtml(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TvmazePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { mode?: string; country?: string; date?: string; q?: string };
  const mode: 'schedule' | 'search' = search.mode === 'search' ? 'search' : 'schedule';
  const country = (search.country ?? 'GB').toUpperCase();
  const date = search.date ?? todayIso();
  const q = search.q ?? '';

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tv">
        <header className="page-hd">
          <div className="label">~/labs/tvmaze</div>
          <h1>tvmaze<span className="dot">.</span></h1>
          <p className="sub">
            tv schedules + show metadata from <code className="inline">api.tvmaze.com</code>. see what&apos;s airing
            tonight in any country, or search for a show and read its episode list.
          </p>
        </header>

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'schedule'}
            className={'tab' + (mode === 'schedule' ? ' active' : '')}
            onClick={() => navigate({ to: '/labs/tvmaze' as never, search: { mode: undefined, country, date: date !== todayIso() ? date : undefined } as never })}
          >schedule</button>
          <button
            role="tab"
            aria-selected={mode === 'search'}
            className={'tab' + (mode === 'search' ? ' active' : '')}
            onClick={() => navigate({ to: '/labs/tvmaze' as never, search: { mode: 'search', q: q || undefined } as never })}
          >search</button>
        </div>

        {mode === 'schedule' ? (
          <Schedule country={country} date={date} onChange={(c, d) => navigate({ to: '/labs/tvmaze' as never, search: { country: c, date: d !== todayIso() ? d : undefined } as never })} />
        ) : (
          <Search q={q} onSubmit={(nq) => navigate({ to: '/labs/tvmaze' as never, search: { mode: 'search', q: nq || undefined } as never })} />
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.tvmaze.com</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Schedule({ country, date, onChange }: { country: string; date: string; onChange: (country: string, date: string) => void }) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Show | null>(null);
  const [ccInput, setCcInput] = useState(country);
  useEffect(() => { setCcInput(country); }, [country]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSchedule(country, date).then((e) => {
      if (cancelled) return;
      setEntries(e);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [country, date]);

  const sorted = useMemo(() => [...entries].sort((a, b) => (a.airtime || '').localeCompare(b.airtime || '')), [entries]);

  return (
    <>
      <form
        className="inp"
        onSubmit={(e) => { e.preventDefault(); onChange(ccInput.toUpperCase().trim() || 'GB', date); }}
      >
        <label className="field">
          <span className="field-label">country</span>
          <input
            value={ccInput}
            onChange={(e) => setCcInput(e.target.value)}
            placeholder="GB"
            maxLength={2}
            style={{ width: 80 }}
            aria-label="country code"
          />
        </label>
        <label className="field">
          <span className="field-label">date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => onChange(country, e.target.value)}
            aria-label="date"
          />
        </label>
        <button type="submit">go →</button>
      </form>

      {loading ? <div className="loading">fetching schedule…</div> : null}
      {!loading && entries.length === 0 ? (
        <div className="empty">nothing scheduled on that date in {country}. try a different country code (US, CA, AU, JP…) or date.</div>
      ) : null}
      {!loading && entries.length > 0 ? (
        <div className="meta">{entries.length.toLocaleString()} airing {date} in {country}</div>
      ) : null}

      <ul className="sched">
        {sorted.map((e) => (
          <li key={e.id} className="s-row">
            <button type="button" className="s-btn" onClick={() => setSelected(e.show)}>
              <span className="s-time">{e.airtime || '—'}</span>
              <span className="s-net">{e.show.network?.name || e.show.webChannel?.name || '—'}</span>
              <span className="s-show">{e.show.name}</span>
              <span className="s-ep">
                {e.season && e.number ? `s${String(e.season).padStart(2, '0')}e${String(e.number).padStart(2, '0')}` : ''} {e.name}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected ? <ShowDetail show={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function Search({ q, onSubmit }: { q: string; onSubmit: (q: string) => void }) {
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);
  const [hits, setHits] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Show | null>(null);

  useEffect(() => {
    if (!q) { setHits([]); return; }
    let cancelled = false;
    setLoading(true);
    searchShows(q).then((s) => {
      if (cancelled) return;
      setHits(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q]);

  return (
    <>
      <form
        className="inp"
        onSubmit={(e) => { e.preventDefault(); onSubmit(input.trim()); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. succession · taskmaster · chernobyl"
          aria-label="show search"
          autoComplete="off"
        />
        <button type="submit">search →</button>
      </form>
      {loading ? <div className="loading">searching…</div> : null}
      {!loading && q && hits.length === 0 ? <div className="empty">no shows matched.</div> : null}

      <section className="grid">
        {hits.map((s) => (
          <button key={s.id} type="button" className="card" onClick={() => setSelected(s)}>
            {s.image?.medium ? (
              <img src={s.image.medium} alt="" loading="lazy" />
            ) : <div className="c-nocover">no image</div>}
            <div className="card-meta">
              <div className="c-title" title={s.name}>{s.name}</div>
              <div className="c-sub">{s.network?.name || s.webChannel?.name || s.type}</div>
              <div className="c-sub t-faint">{s.premiered?.slice(0, 4) || ''}</div>
            </div>
          </button>
        ))}
      </section>

      {selected ? <ShowDetail show={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function ShowDetail({ show, onClose }: { show: Show; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fields: Array<[string, string | undefined]> = [
    ['type', show.type],
    ['status', show.status],
    ['genres', show.genres?.join(', ')],
    ['network', show.network?.name],
    ['country', show.network?.country?.name],
    ['language', show.language],
    ['premiered', show.premiered],
    ['ended', show.ended ?? undefined],
    ['runtime', show.runtime ? `${show.runtime} min` : show.averageRuntime ? `${show.averageRuntime} min` : undefined],
    ['rating', typeof show.rating?.average === 'number' ? `${show.rating.average.toFixed(1)} / 10` : undefined],
  ];

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" type="button" onClick={onClose} aria-label="close">×</button>
        {show.image?.original ? (
          <img src={show.image.original} alt={show.name} className="modal-img" />
        ) : <div className="modal-img modal-img-empty">no image</div>}
        <div className="modal-info">
          <div className="m-title">{show.name}</div>
          <dl className="m-fields">
            {fields.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="m-row"><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {show.summary ? <p className="m-desc">{stripHtml(show.summary)}</p> : null}
          {show.officialSite ? (
            <a href={show.officialSite} target="_blank" rel="noopener noreferrer" className="m-link">official site →</a>
          ) : null}
          {show.url ? (
            <a href={show.url} target="_blank" rel="noopener noreferrer" className="m-link" style={{ marginLeft: 12 }}>tvmaze →</a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-tv { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .tabs { margin-top: var(--sp-5); display: flex; border: 1px solid var(--color-border); width: fit-content; background: var(--color-bg-panel); }
  .tab { background: transparent; border: 0; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); padding: 8px var(--sp-4); cursor: pointer; border-right: 1px solid var(--color-border); }
  .tab:last-child { border-right: 0; }
  .tab.active { background: var(--color-accent); color: var(--color-bg); }
  .tab:hover:not(.active) { color: var(--color-fg); }

  .inp { margin-top: var(--sp-4); display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: end; }
  .inp input { background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); padding: 8px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp input[placeholder="e.g. succession · taskmaster · chernobyl"] { flex: 1; min-width: 240px; font-size: var(--fs-md); padding: 10px var(--sp-3); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 10px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }

  .meta { margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .loading, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); line-height: 1.55; }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .sched { list-style: none; margin-top: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .s-row { border-bottom: 1px dashed var(--color-border); }
  .s-row:last-child { border-bottom: 0; }
  .s-btn { width: 100%; display: grid; grid-template-columns: 60px 160px 1fr 2fr; gap: var(--sp-3); align-items: center; padding: var(--sp-2) var(--sp-3); background: transparent; border: 0; color: inherit; cursor: pointer; text-align: left; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .s-btn:hover { background: var(--color-bg-raised); }
  @media (max-width: 720px) { .s-btn { grid-template-columns: 60px 1fr; grid-template-rows: auto auto; } .s-net, .s-ep { grid-column: 2; } }
  .s-time { color: var(--color-accent); font-variant-numeric: tabular-nums; }
  .s-net { color: var(--color-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s-show { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s-ep { color: var(--color-fg-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .grid { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--sp-3); }
  .card { text-align: left; padding: 0; border: 1px solid var(--color-border); background: var(--color-bg-panel); cursor: pointer; display: flex; flex-direction: column; color: inherit; overflow: hidden; }
  .card:hover { border-color: var(--color-accent-dim); }
  .card img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; display: block; background: var(--color-bg-raised); }
  .c-nocover { width: 100%; aspect-ratio: 2 / 3; background: var(--color-bg-raised); display: flex; align-items: center; justify-content: center; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: 11px; }
  .card-meta { padding: var(--sp-2) var(--sp-3); font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 2px; }
  .c-title { color: var(--color-fg); font-size: var(--fs-xs); font-family: var(--font-display); letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-sub { color: var(--color-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .modal { position: fixed; inset: 0; background: color-mix(in oklch, black 80%, transparent); z-index: 60; display: flex; align-items: center; justify-content: center; padding: var(--sp-4); overflow: auto; }
  .modal-body { background: var(--color-bg); border: 1px solid var(--color-accent-dim); max-width: 900px; width: 100%; max-height: 92vh; overflow: auto; position: relative; display: grid; grid-template-columns: 280px 1fr; }
  @media (max-width: 720px) { .modal-body { grid-template-columns: 1fr; } }
  .modal-x { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 28px; cursor: pointer; z-index: 2; line-height: 1; }
  .modal-x:hover { color: var(--color-accent); }
  .modal-img { width: 100%; object-fit: contain; background: var(--color-bg); max-height: 92vh; }
  .modal-img-empty { display: flex; align-items: center; justify-content: center; color: var(--color-fg-faint); font-family: var(--font-mono); min-height: 300px; }
  .modal-info { padding: var(--sp-5) var(--sp-4); border-left: 1px solid var(--color-border); overflow: auto; }
  @media (max-width: 720px) { .modal-info { border-left: 0; border-top: 1px solid var(--color-border); } }
  .m-title { font-family: var(--font-display); font-size: var(--fs-lg); color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.2; margin-bottom: var(--sp-3); }
  .m-fields { display: flex; flex-direction: column; gap: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: var(--sp-3); }
  .m-row { display: grid; grid-template-columns: 90px 1fr; gap: var(--sp-2); line-height: 1.5; }
  .m-row dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .m-row dd { color: var(--color-fg-dim); }
  .m-desc { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.6; padding: var(--sp-3); background: var(--color-bg-panel); border-left: 2px solid var(--color-accent-dim); margin-bottom: var(--sp-3); white-space: pre-wrap; }
  .m-link { display: inline-block; margin-top: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-decoration: none; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 2px; }
  .m-link:hover { color: var(--color-fg); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
