import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchArrivals, searchStopPoints, lineColor, type Arrival } from '../../lib/tfl';

// A handful of popular stations pre-seeded as quick-pick chips — selected to
// show the common case (interchange stations with many platforms) and to
// cover tube + dlr + overground + elizabeth line.
const QUICK: { id: string; name: string }[] = [
  { id: '940GZZLUOXC', name: 'Oxford Circus' },
  { id: '940GZZLUKSX', name: "King's Cross St. Pancras" },
  { id: '940GZZLUVIC', name: 'Victoria' },
  { id: '940GZZLUBND', name: 'Bond Street' },
  { id: '940GZZLUWLO', name: 'Waterloo' },
  { id: '940GZZLULVT', name: 'Liverpool Street' },
  { id: '940GZZLUBNK', name: 'Bank' },
  { id: '940GZZLUPAC', name: 'Paddington' },
];

export default function TflArrivalsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { id?: string; name?: string };
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    search.id ? { id: search.id, name: search.name ?? search.id } : null,
  );

  // debounce the search query to avoid spamming the api on every keypress
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input.trim()), 250);
    return () => window.clearTimeout(t);
  }, [input]);

  const suggestionsQuery = useQuery({
    queryKey: ['tfl-search', debounced],
    queryFn: () => searchStopPoints(debounced),
    enabled: debounced.length >= 2 && !selected,
    staleTime: 30_000,
  });

  const arrivalsQuery = useQuery({
    queryKey: ['tfl-arrivals', selected?.id],
    queryFn: () => fetchArrivals(selected!.id),
    enabled: !!selected,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const pick = (s: { id: string; name: string }) => {
    setSelected(s);
    setInput('');
    navigate({ to: '/labs/tfl-arrivals' as never, search: { id: s.id, name: s.name } as never });
  };

  const clear = () => {
    setSelected(null);
    setInput('');
    navigate({ to: '/labs/tfl-arrivals' as never, search: {} as never });
  };

  const grouped = useMemo(() => groupByPlatform(arrivalsQuery.data ?? []), [arrivalsQuery.data]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-arr">
        <header className="page-hd">
          <div className="label">~/labs/tfl/arrivals</div>
          <h1>arrivals<span className="dot">.</span></h1>
          <p className="sub">
            live next-train board for any london station. search by name or pick a quick station,
            then watch platform-by-platform arrivals count down. refreshes every 30 seconds.
          </p>
        </header>

        {selected ? (
          <section className="station">
            <div className="st-info">
              <div className="st-name">{selected.name}</div>
              <div className="st-id">
                naptan · {selected.id}
                {arrivalsQuery.dataUpdatedAt ? ` · updated ${relTime(arrivalsQuery.dataUpdatedAt)}` : ''}
              </div>
            </div>
            <button className="change-btn" onClick={clear}>change station ×</button>
          </section>
        ) : (
          <section className="pick">
            <input
              className="input"
              placeholder="search tube / dlr / overground / elizabeth / tram / bus stop…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {suggestionsQuery.data && suggestionsQuery.data.length > 0 ? (
              <div className="suggestions">
                {suggestionsQuery.data.slice(0, 8).map((s) => (
                  <button key={s.id} className="sug" onClick={() => pick({ id: s.id, name: s.name })}>
                    <span>{s.name}</span>
                    <span className="sug-modes">{s.modes.join(' · ')}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="quick-row">
              <span className="t-faint">or</span>
              {QUICK.map((s) => (
                <button key={s.id} className="quick" onClick={() => pick(s)}>{s.name}</button>
              ))}
            </div>
          </section>
        )}

        {arrivalsQuery.isError ? (
          <div className="err">tfl couldn&apos;t return arrivals for that station.</div>
        ) : null}

        {selected && arrivalsQuery.data ? (
          grouped.length === 0 ? (
            <div className="empty">no arrivals in the next ~30 minutes.</div>
          ) : (
            <section className="platforms">
              {grouped.map(({ platform, arrivals }) => (
                <div key={platform} className="platform">
                  <div className="pf-hd">{platform}</div>
                  <ul className="pf-list">
                    {arrivals.slice(0, 5).map((a) => {
                      const col = lineColor(a.lineId);
                      return (
                        <li key={a.id} className="pf-row">
                          <span className="line-chip" style={{ background: col.bg, color: col.fg }}>{col.label}</span>
                          <span className="pf-to">{a.towards || a.destinationName}</span>
                          <span className="pf-loc">{a.currentLocation}</span>
                          <span className="pf-eta">{formatEta(a.timeToStation)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">tfl /stoppoint · 30s refresh</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function groupByPlatform(arrivals: Arrival[]) {
  const m = new Map<string, Arrival[]>();
  for (const a of arrivals) {
    const key = a.platformName || '—';
    const list = m.get(key) ?? [];
    list.push(a);
    m.set(key, list);
  }
  return [...m.entries()]
    .map(([platform, list]) => ({ platform, arrivals: list.sort((a, b) => a.timeToStation - b.timeToStation) }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

function formatEta(seconds: number): string {
  if (seconds < 30) return 'due';
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function relTime(ts: number): string {
  const d = Math.round((Date.now() - ts) / 1000);
  if (d < 2) return 'just now';
  if (d < 60) return `${d}s ago`;
  return `${Math.round(d / 60)}m ago`;
}

const CSS = `
  .shell-arr { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .pick { margin-top: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
  .input { background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); padding: 10px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-md); outline: 0; }
  .input:focus { border-color: var(--color-accent-dim); }
  .suggestions { border: 1px solid var(--color-border); background: var(--color-bg-panel); display: flex; flex-direction: column; }
  .sug { background: transparent; border: 0; border-bottom: 1px dashed var(--color-border); color: var(--color-fg); padding: 8px var(--sp-3); text-align: left; cursor: pointer; font-family: var(--font-mono); font-size: var(--fs-sm); display: flex; justify-content: space-between; gap: var(--sp-3); }
  .sug:last-child { border-bottom: 0; }
  .sug:hover { background: var(--color-bg-raised); color: var(--color-accent); }
  .sug-modes { color: var(--color-fg-faint); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; }
  .quick-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .quick { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 3px 9px; font-family: inherit; font-size: inherit; cursor: pointer; }
  .quick:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .station { margin-top: var(--sp-5); display: flex; justify-content: space-between; align-items: center; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); flex-wrap: wrap; gap: var(--sp-3); }
  .st-name { font-family: var(--font-display); font-size: 28px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1.1; }
  .st-id { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; }
  .change-btn { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .change-btn:hover { color: var(--color-alert); border-color: var(--color-alert); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .empty { margin-top: var(--sp-5); padding: var(--sp-6); text-align: center; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-sm); border: 1px dashed var(--color-border); }

  .platforms { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: var(--sp-3); }
  .platform { border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .pf-hd { padding: 8px var(--sp-3); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); letter-spacing: 0.08em; text-transform: uppercase; }
  .pf-list { list-style: none; }
  .pf-row {
    display: grid;
    grid-template-columns: 100px 1fr 140px 60px;
    gap: var(--sp-2);
    padding: 6px var(--sp-3);
    align-items: center;
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .pf-row:last-child { border-bottom: 0; }
  .line-chip { padding: 1px 6px; font-size: 10px; letter-spacing: 0.04em; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .pf-to { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-loc { color: var(--color-fg-faint); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-eta { color: var(--color-accent); text-align: right; font-variant-numeric: tabular-nums; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
