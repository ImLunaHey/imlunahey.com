import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPostcode, lookupPostcode } from '../../lib/postcodes';

// Canonical police.uk categories with display labels + colours chosen for
// visual distinction on a black radar background.
const CATEGORIES: Record<string, { label: string; color: string }> = {
  'anti-social-behaviour':  { label: 'anti-social',     color: '#ff8c6a' },
  'bicycle-theft':          { label: 'bicycle theft',   color: '#a7d96a' },
  'burglary':               { label: 'burglary',        color: '#ff5a5a' },
  'criminal-damage-arson':  { label: 'damage/arson',    color: '#ff9f3a' },
  'drugs':                  { label: 'drugs',           color: '#b78ae0' },
  'other-theft':            { label: 'other theft',     color: '#ffe76a' },
  'possession-of-weapons':  { label: 'weapons',         color: '#ff3a4a' },
  'public-order':           { label: 'public order',    color: '#6ae0d6' },
  'robbery':                { label: 'robbery',         color: '#ff5a9a' },
  'shoplifting':            { label: 'shoplifting',     color: '#8adfff' },
  'theft-from-the-person':  { label: 'theft (person)',  color: '#ffd166' },
  'vehicle-crime':          { label: 'vehicle crime',   color: '#e0c06a' },
  'violent-crime':          { label: 'violent',         color: '#ff2d3a' },
  'other-crime':            { label: 'other',           color: '#9a9a9a' },
};

type Crime = {
  id: number;
  category: string;
  month: string;
  location: { latitude: string; longitude: string; street?: { name: string } };
  outcome_status: { category: string; date: string } | null;
};

async function fetchCrimes(lat: number, lon: number, month: string): Promise<Crime[]> {
  const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lon}&date=${month}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`police.uk ${r.status}`);
  return r.json();
}

// Police data is released on a one-month lag. `available` date returned by
// /api/crimes-street-dates is the canonical latest month. Cache heavily —
// it changes at most once a month.
async function fetchLatestMonth(): Promise<string> {
  try {
    const r = await fetch('https://data.police.uk/api/crimes-street-dates');
    if (!r.ok) throw new Error('bad');
    const j = (await r.json()) as Array<{ date: string }>;
    return j[0]?.date ?? defaultMonth();
  } catch {
    return defaultMonth();
  }
}

function defaultMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2); // ~2 month lag is typical
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CrimePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? 'SW1A 1AA');

  const monthQuery = useQuery({
    queryKey: ['police-dates'],
    queryFn: fetchLatestMonth,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const month = monthQuery.data ?? defaultMonth();

  const pcQuery = useQuery({
    queryKey: ['postcode', search.q],
    queryFn: () => lookupPostcode(search.q ?? ''),
    enabled: !!search.q,
    staleTime: Infinity,
    retry: false,
  });

  const crimesQuery = useQuery({
    queryKey: ['crimes', pcQuery.data?.latitude, pcQuery.data?.longitude, month],
    queryFn: () => fetchCrimes(pcQuery.data!.latitude, pcQuery.data!.longitude, month),
    enabled: !!pcQuery.data,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = formatPostcode(input.trim());
    if (!q) return;
    navigate({ to: '/labs/crime' as never, search: { q } as never });
  };

  const crimes = crimesQuery.data ?? [];
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of crimes) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [crimes]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !pcQuery.data) return;
    drawRadar(canvasRef.current, crimes, pcQuery.data.latitude, pcQuery.data.longitude);
  }, [crimes, pcQuery.data]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-crime">
        <header className="page-hd">
          <div className="label">~/labs/crime</div>
          <h1>crime<span className="dot">.</span></h1>
          <p className="sub">
            every recorded street crime within one mile of a uk postcode, from the home office&apos;s
            police.uk open data feed. data is released on a ~two-month lag.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="postcode — e.g. SW1A 1AA"
            aria-label="uk postcode"
            spellCheck={false}
            autoComplete="postal-code"
          />
          <button type="submit">lookup →</button>
        </form>

        {pcQuery.isError || (!pcQuery.isLoading && search.q && !pcQuery.data) ? (
          <div className="err">no match for &quot;{search.q}&quot; — check the postcode.</div>
        ) : null}

        {pcQuery.data ? (
          <>
            <section className="loc">
              <div>
                <div className="loc-name">{pcQuery.data.postcode}</div>
                <div className="loc-sub">{pcQuery.data.admin_district ?? '—'} · {pcQuery.data.region ?? '—'}</div>
              </div>
              <div className="loc-stats">
                <div><span className="k">month</span><b>{month}</b></div>
                <div><span className="k">crimes (1mi)</span><b>{crimes.length.toLocaleString()}</b></div>
              </div>
            </section>

            <section className="canvas-wrap">
              <canvas ref={canvasRef} width={900} height={900} className="canvas" />
              <div className="legend">
                {byCategory.map(([cat, n]) => {
                  const c = CATEGORIES[cat] ?? { label: cat, color: '#9a9a9a' };
                  return (
                    <div key={cat} className="leg">
                      <span className="sw" style={{ background: c.color }} />
                      <span className="lbl">{c.label}</span>
                      <span className="n">{n}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {crimesQuery.isLoading ? <div className="loading">loading crimes…</div> : null}
            {crimesQuery.isError ? <div className="err">couldn&apos;t fetch crimes — police.uk returned an error.</div> : null}
          </>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">data.police.uk · postcodes.io</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

// Radar-style draw: concentric rings at 0.25 / 0.5 / 0.75 / 1.0 miles from
// the searched postcode, with a dot per crime at its relative offset. Pure
// canvas, no map tiles — the 1-mile bbox is small enough that a flat
// equirectangular projection is visually accurate.
function drawRadar(canvas: HTMLCanvasElement, crimes: Crime[], cLat: number, cLon: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const pxPerMile = Math.min(W, H) / 2.2; // slight padding from edge

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // rings
  ctx.strokeStyle = 'rgba(106,234,160,0.18)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, pxPerMile * (i / 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ring labels
  ctx.fillStyle = 'rgba(106,234,160,0.45)';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= 4; i++) {
    ctx.fillText(`${i / 4}mi`, cx + pxPerMile * (i / 4) + 4, cy);
  }

  // crosshair
  ctx.strokeStyle = 'rgba(106,234,160,0.3)';
  ctx.beginPath();
  ctx.moveTo(cx - pxPerMile, cy); ctx.lineTo(cx + pxPerMile, cy);
  ctx.moveTo(cx, cy - pxPerMile); ctx.lineTo(cx, cy + pxPerMile);
  ctx.stroke();

  // crimes
  const latDegPerMile = 1 / 69;
  const lonDegPerMile = 1 / (69 * Math.cos((cLat * Math.PI) / 180));
  for (const cr of crimes) {
    const lat = Number(cr.location.latitude);
    const lon = Number(cr.location.longitude);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const dx = ((lon - cLon) / lonDegPerMile) * pxPerMile;
    const dy = -((lat - cLat) / latDegPerMile) * pxPerMile;
    const col = CATEGORIES[cr.category]?.color ?? '#9a9a9a';

    ctx.fillStyle = col + 'cc';
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // centre marker
  ctx.strokeStyle = '#6aeaa0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#6aeaa0';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

const CSS = `
  .shell-crime { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; letter-spacing: 0.08em; text-transform: uppercase; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }

  .loc { margin-top: var(--sp-4); display: flex; justify-content: space-between; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); gap: var(--sp-4); flex-wrap: wrap; }
  .loc-name { font-family: var(--font-display); font-size: 28px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1.1; }
  .loc-sub { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
  .loc-stats { display: flex; gap: var(--sp-4); }
  .loc-stats > div { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .loc-stats .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .loc-stats b { color: var(--color-fg); font-size: var(--fs-md); font-weight: 400; }

  .canvas-wrap { margin-top: var(--sp-4); display: grid; grid-template-columns: 2fr 1fr; gap: var(--sp-3); }
  @media (max-width: 720px) { .canvas-wrap { grid-template-columns: 1fr; } }
  .canvas { width: 100%; height: auto; border: 1px solid var(--color-border); display: block; background: #000; }
  .legend { border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3); display: flex; flex-direction: column; gap: 4px; }
  .leg { display: grid; grid-template-columns: 14px 1fr auto; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: var(--fs-xs); padding: 2px 0; }
  .leg .sw { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .leg .lbl { color: var(--color-fg-dim); }
  .leg .n { color: var(--color-accent); font-variant-numeric: tabular-nums; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
