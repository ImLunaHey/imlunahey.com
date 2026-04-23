import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchRoadDisruptions, type RoadDisruption } from '../../lib/tfl';
import { drawLondonBg, drawThamesOverlay, latLonToXY, inBbox } from '../../lib/london-bg';

const SEVERITY_COLOR: Record<string, string> = {
  'Serious':    '#ff5a5a',
  'Severe':     '#ff9f6a',
  'Moderate':   '#ffd166',
  'Minimal':    '#9a9a9a',
};

function parsePoint(p?: string): [number, number] | null {
  if (!p) return null;
  const [lat, lon] = p.split(',').map(Number);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return [lat, lon];
}

export default function TflRoadsPage() {
  const q = useQuery({
    queryKey: ['tfl-roads'],
    queryFn: fetchRoadDisruptions,
    refetchInterval: 5 * 60 * 1000,
  });

  const disruptions = q.data ?? [];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [severity, setSeverity] = useState<string>('all');
  const [selected, setSelected] = useState<RoadDisruption | null>(null);

  const severities = useMemo(() => {
    const set = new Set<string>();
    for (const d of disruptions) set.add(d.severity);
    return [...set].sort((a, b) => severityWeight(b) - severityWeight(a));
  }, [disruptions]);

  const filtered = useMemo(() => {
    const f = severity === 'all' ? disruptions : disruptions.filter((d) => d.severity === severity);
    return f.slice().sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
  }, [disruptions, severity]);

  useEffect(() => {
    if (!canvasRef.current) return;
    draw(canvasRef.current, filtered);
  }, [filtered]);

  const counts: Record<string, number> = {};
  for (const d of disruptions) counts[d.severity] = (counts[d.severity] ?? 0) + 1;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-roads">
        <header className="page-hd">
          <div className="label">~/labs/tfl/roads</div>
          <h1>roads<span className="dot">.</span></h1>
          <p className="sub">
            every current road disruption on tfl&apos;s network — closures, roadworks, events, floods.
            filter by severity, click a pin for details. refreshes every five minutes.
          </p>
          <div className="counts">
            {severities.map((s) => (
              <span key={s} className="count-chip" style={{ color: SEVERITY_COLOR[s] ?? '#9a9a9a', borderColor: SEVERITY_COLOR[s] ?? '#333' }}>
                {counts[s]} {s.toLowerCase()}
              </span>
            ))}
            <span className="t-faint">· {disruptions.length} total</span>
          </div>
        </header>

        <section className="ctrl">
          <div className="seg">
            <button className={`seg-btn ${severity === 'all' ? 'on' : ''}`} onClick={() => setSeverity('all')}>
              all
            </button>
            {severities.map((s) => (
              <button key={s} className={`seg-btn ${severity === s ? 'on' : ''}`} onClick={() => setSeverity(s)}>
                {s.toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            className="canvas"
            onClick={(e) => {
              const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 1200;
              const y = ((e.clientY - rect.top) / rect.height) * 700;
              setSelected(findNearest(filtered, x, y));
            }}
          />
        </section>

        {selected ? (
          <section className="sel">
            <div className="sel-hd">
              <span className="sev-chip" style={{ color: SEVERITY_COLOR[selected.severity] ?? '#9a9a9a', borderColor: SEVERITY_COLOR[selected.severity] ?? '#333' }}>
                {selected.severity}
              </span>
              <div className="sel-loc">{selected.location}</div>
              <button className="dismiss" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="sel-meta">
              <span>{selected.category}{selected.subCategory ? ` · ${selected.subCategory}` : ''}</span>
              {selected.startDateTime ? <span>from {fmtDate(selected.startDateTime)}</span> : null}
              {selected.endDateTime ? <span>until {fmtDate(selected.endDateTime)}</span> : null}
            </div>
            {selected.comments ? <div className="sel-body">{selected.comments}</div> : null}
            {selected.currentUpdate ? <div className="sel-body t-faint">update · {selected.currentUpdate}</div> : null}
          </section>
        ) : null}

        <section className="list">
          <div className="list-hd">{filtered.length} disruption{filtered.length === 1 ? '' : 's'} shown</div>
          {filtered.slice(0, 40).map((d) => (
            <button key={d.id} className="row" onClick={() => setSelected(d)}>
              <span className="sev-dot" style={{ background: SEVERITY_COLOR[d.severity] ?? '#9a9a9a' }} />
              <span className="row-sev">{d.severity}</span>
              <span className="row-loc">{d.location}</span>
              <span className="row-cat">{d.category}</span>
            </button>
          ))}
        </section>

        <footer className="labs-footer">
          <span>source · <span className="t-accent">tfl /road/all/disruption</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function severityWeight(s: string): number {
  switch (s) {
    case 'Serious': return 4;
    case 'Severe': return 3;
    case 'Moderate': return 2;
    case 'Minimal': return 1;
    default: return 0;
  }
}

function findNearest(list: RoadDisruption[], x: number, y: number): RoadDisruption | null {
  let best: RoadDisruption | null = null;
  let bestD = 18 * 18;
  for (const d of list) {
    const p = parsePoint(d.point);
    if (!p || !inBbox(p[0], p[1])) continue;
    const [px, py] = latLonToXY(p[0], p[1], 1200, 700);
    const dd = (px - x) ** 2 + (py - y) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

function draw(canvas: HTMLCanvasElement, list: RoadDisruption[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  drawLondonBg(ctx, W, H);

  // draw least-severe first so serious items sit on top
  const sorted = list.slice().sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));
  for (const d of sorted) {
    const p = parsePoint(d.point);
    if (!p || !inBbox(p[0], p[1])) continue;
    const [x, y] = latLonToXY(p[0], p[1], W, H);
    const c = SEVERITY_COLOR[d.severity] ?? '#9a9a9a';
    const r = severityWeight(d.severity) + 3;

    // soft halo (smaller + lighter than the original 3× glow so the map
    // underneath stays visible in dense clusters)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
    g.addColorStop(0, c + '55');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawThamesOverlay(ctx, W, H);
}

function fmtDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
}

const CSS = `
  .shell-roads { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }
  .counts { margin-top: var(--sp-4); display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .count-chip { padding: 2px 8px; border: 1px solid; text-transform: lowercase; }

  .ctrl { margin-top: var(--sp-4); }
  .seg { display: inline-flex; border: 1px solid var(--color-border); flex-wrap: wrap; }
  .seg-btn { background: transparent; border: 0; color: var(--color-fg-dim); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; text-transform: lowercase; }
  .seg-btn + .seg-btn { border-left: 1px solid var(--color-border); }
  .seg-btn.on { color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }

  .canvas-wrap { margin-top: var(--sp-3); }
  .canvas { width: 100%; height: auto; border: 1px solid var(--color-border); display: block; cursor: crosshair; }

  .sel { margin-top: var(--sp-3); border: 1px solid var(--color-accent-dim); background: var(--color-bg-panel); }
  .sel-hd { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-bottom: 1px solid var(--color-border); }
  .sev-chip { padding: 2px 8px; border: 1px solid; font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; }
  .sel-loc { color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); flex: 1; }
  .dismiss { background: transparent; border: 0; color: var(--color-fg-faint); font-size: var(--fs-lg); cursor: pointer; }
  .dismiss:hover { color: var(--color-alert); }
  .sel-meta { padding: var(--sp-2) var(--sp-3); display: flex; gap: var(--sp-3); flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .sel-body { padding: var(--sp-3); color: var(--color-fg-dim); font-size: var(--fs-sm); line-height: 1.55; border-top: 1px dashed var(--color-border); }

  .list { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .list-hd { padding: 8px var(--sp-3); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .row { display: grid; grid-template-columns: 12px 90px 1fr 160px; gap: var(--sp-2); align-items: center; padding: 6px var(--sp-3); border: 0; border-bottom: 1px dashed var(--color-border); background: transparent; color: var(--color-fg); cursor: pointer; text-align: left; font-family: var(--font-mono); font-size: var(--fs-xs); width: 100%; }
  .row:last-child { border-bottom: 0; }
  .row:hover { background: var(--color-bg-raised); color: var(--color-accent); }
  .sev-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .row-sev { color: var(--color-fg-dim); text-transform: lowercase; }
  .row-loc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-cat { color: var(--color-fg-faint); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
