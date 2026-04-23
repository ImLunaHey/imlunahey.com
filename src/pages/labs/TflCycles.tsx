import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchBikePoints, type BikePoint } from '../../lib/tfl';
import { drawLondonBg, drawThamesOverlay, latLonToXY, inBbox } from '../../lib/london-bg';

type HoverState = { dock: BikePoint; x: number; y: number } | null;

export default function TflCyclesPage() {
  const q = useQuery({
    queryKey: ['tfl-bikepoints'],
    queryFn: fetchBikePoints,
    refetchInterval: 60_000,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const [mode, setMode] = useState<'bikes' | 'spaces'>('bikes');

  const docks = q.data ?? [];
  const totals = useMemo(() => {
    let bikes = 0, ebikes = 0, standardBikes = 0, emptyDocks = 0, totalDocks = 0, offline = 0;
    for (const d of docks) {
      bikes += d.bikes;
      ebikes += d.ebikes ?? 0;
      standardBikes += d.standardBikes ?? 0;
      emptyDocks += d.emptyDocks;
      totalDocks += d.totalDocks;
      if (d.totalDocks > 0 && d.bikes + d.emptyDocks === 0) offline++;
    }
    return { bikes, ebikes, standardBikes, emptyDocks, totalDocks, offline };
  }, [docks]);

  useEffect(() => {
    if (!canvasRef.current) return;
    draw(canvasRef.current, docks, mode);
  }, [docks, mode]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cycles">
        <header className="page-hd">
          <div className="label">~/labs/tfl/cycles</div>
          <h1>cycles<span className="dot">.</span></h1>
          <p className="sub">
            every santander cycles docking station in london, live availability. hover any dot for
            bikes / spaces / e-bikes. refreshes every minute. data from tfl&apos;s bikepoint api.
          </p>
          <div className="stats">
            <div className="stat"><span className="k">docks</span><b>{docks.length}</b></div>
            <div className="stat"><span className="k">bikes available</span><b>{totals.bikes.toLocaleString()}</b></div>
            <div className="stat"><span className="k">e-bikes</span><b>{totals.ebikes.toLocaleString()}</b></div>
            <div className="stat"><span className="k">free spaces</span><b>{totals.emptyDocks.toLocaleString()}</b></div>
            <div className="stat"><span className="k">capacity</span><b>{totals.totalDocks.toLocaleString()}</b></div>
            <div className="stat"><span className="k">offline</span><b className={totals.offline > 0 ? 't-alert' : ''}>{totals.offline}</b></div>
          </div>
        </header>

        <section className="controls">
          <div className="seg">
            <button className={`seg-btn ${mode === 'bikes' ? 'on' : ''}`} onClick={() => setMode('bikes')}>
              colour by bikes available
            </button>
            <button className={`seg-btn ${mode === 'spaces' ? 'on' : ''}`} onClick={() => setMode('spaces')}>
              colour by free spaces
            </button>
          </div>
          <div className="legend">
            <span><span className="sw" style={{ background: '#ff5a5a' }} /> empty</span>
            <span><span className="sw" style={{ background: '#ffb74a' }} /> low</span>
            <span><span className="sw" style={{ background: '#ffe76a' }} /> ok</span>
            <span><span className="sw" style={{ background: '#6aeaa0' }} /> plenty</span>
          </div>
        </section>

        <section className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            className="canvas"
            onMouseMove={(e) => {
              const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 1200;
              const y = ((e.clientY - rect.top) / rect.height) * 700;
              const dock = findNearest(docks, x, y);
              if (dock) setHover({ dock, x: e.clientX - rect.left, y: e.clientY - rect.top });
              else setHover(null);
            }}
            onMouseLeave={() => setHover(null)}
          />
          {hover ? (
            <div className="tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
              <b>{hover.dock.commonName}</b>
              <span>bikes · {hover.dock.bikes}{hover.dock.ebikes ? ` (${hover.dock.ebikes} ebikes)` : ''}</span>
              <span>spaces · {hover.dock.emptyDocks}</span>
              <span className="t-faint">capacity · {hover.dock.totalDocks}</span>
            </div>
          ) : null}
        </section>

        {q.isError ? <div className="err">could not reach tfl bikepoint api.</div> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">tfl bikepoint api · {docks.length} docks</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function findNearest(docks: BikePoint[], x: number, y: number): BikePoint | null {
  let best: BikePoint | null = null;
  let bestD = 16 * 16;
  for (const d of docks) {
    if (!inBbox(d.lat, d.lon)) continue;
    const [dx, dy] = latLonToXY(d.lat, d.lon, 1200, 700);
    const dd = (dx - x) ** 2 + (dy - y) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

function dockColor(d: BikePoint, mode: 'bikes' | 'spaces'): string {
  const total = d.totalDocks || 1;
  const value = mode === 'bikes' ? d.bikes : d.emptyDocks;
  const ratio = value / total;
  if (ratio >= 0.6) return '#6aeaa0';
  if (ratio >= 0.3) return '#ffe76a';
  if (ratio >= 0.1) return '#ffb74a';
  return '#ff5a5a';
}

function draw(canvas: HTMLCanvasElement, docks: BikePoint[], mode: 'bikes' | 'spaces') {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  drawLondonBg(ctx, W, H);

  // Plot as plain filled circles. Earlier versions used a 3× radial glow per
  // dot, but with 800 docks packed into zone 1–2 the glows overlapped so
  // heavily that the Thames underneath disappeared. Flat dots + a re-stroked
  // Thames overlay reads much better.
  for (const d of docks) {
    if (!inBbox(d.lat, d.lon)) continue;
    const [x, y] = latLonToXY(d.lat, d.lon, W, H);
    const c = dockColor(d, mode);
    const r = 2 + Math.min(4, Math.sqrt(d.totalDocks) / 4);

    // subtle rim for legibility on dark bg
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Re-stroke the Thames so it always wins over the dot layer.
  drawThamesOverlay(ctx, W, H);
}

const CSS = `
  .shell-cycles { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stat .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { color: var(--color-fg); font-weight: 400; font-size: var(--fs-md); }

  .controls { margin-top: var(--sp-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--sp-3); }
  .seg { display: inline-flex; border: 1px solid var(--color-border); }
  .seg-btn { background: transparent; border: 0; color: var(--color-fg-dim); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .seg-btn + .seg-btn { border-left: 1px solid var(--color-border); }
  .seg-btn.on { color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .legend { display: flex; gap: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); align-items: center; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; box-shadow: 0 0 4px currentColor; }

  .canvas-wrap { margin-top: var(--sp-3); position: relative; }
  .canvas { width: 100%; height: auto; border: 1px solid var(--color-border); display: block; cursor: crosshair; }
  .tip {
    position: absolute;
    background: color-mix(in oklch, var(--color-bg) 92%, transparent);
    border: 1px solid var(--color-accent-dim);
    padding: 6px 10px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    display: flex; flex-direction: column; gap: 2px;
    pointer-events: none;
  }
  .tip b { color: var(--color-accent); font-weight: 400; }
  .tip span { color: var(--color-fg-dim); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
