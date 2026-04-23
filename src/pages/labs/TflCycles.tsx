import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchBikePoints, type BikePoint } from '../../lib/tfl';
import { drawBoroughLabels, drawLondonBg, drawThamesOverlay, ensureLondonBoroughs, ensureLondonRoads, latLonToXY, inBbox } from '../../lib/london-bg';
import { pointerToBuffer, useCanvasViewport, type Viewport } from '../../lib/canvas-viewport';

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
  const viewport = useCanvasViewport({ minScale: 1, maxScale: 16 });

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

  // rAF-batched redraw: rapid pan/zoom events (which each update viewport.vp)
  // coalesce into one canvas paint per animation frame.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (canvasRef.current) draw(canvasRef.current, docks, mode, viewport.vp);
    });
    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [docks, mode, viewport.vp]);

  // Kick off both fetches on mount; repaint whenever either lands so the
  // map upgrades progressively.
  useEffect(() => {
    const redraw = () => { if (canvasRef.current) draw(canvasRef.current, docks, mode, viewport.vp); };
    ensureLondonBoroughs().then(redraw);
    ensureLondonRoads().then(redraw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            ref={(el) => { canvasRef.current = el; viewport.setCanvasRef(el); }}
            width={1200}
            height={700}
            className="canvas"
            style={{ cursor: viewport.dragging ? 'grabbing' : 'grab' }}
            onPointerDown={viewport.onPointerDown}
            onPointerUp={viewport.onPointerUp}
            onPointerMove={(e) => {
              viewport.onPointerMove(e);
              if (viewport.dragging) { setHover(null); return; }
              const [bx, by] = pointerToBuffer(e, e.currentTarget);
              const wx = (bx - viewport.vp.tx) / viewport.vp.scale;
              const wy = (by - viewport.vp.ty) / viewport.vp.scale;
              const dock = findNearest(docks, wx, wy, viewport.vp.scale);
              const rect = e.currentTarget.getBoundingClientRect();
              if (dock) setHover({ dock, x: e.clientX - rect.left, y: e.clientY - rect.top });
              else setHover(null);
            }}
            onPointerLeave={() => setHover(null)}
          />
          {hover ? (
            <div className="tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
              <b>{hover.dock.commonName}</b>
              <span>bikes · {hover.dock.bikes}{hover.dock.ebikes ? ` (${hover.dock.ebikes} ebikes)` : ''}</span>
              <span>spaces · {hover.dock.emptyDocks}</span>
              <span className="t-faint">capacity · {hover.dock.totalDocks}</span>
            </div>
          ) : null}
          <div className="vp-ctrl">
            <span>zoom · {viewport.vp.scale.toFixed(1)}×</span>
            <button onClick={viewport.reset} disabled={viewport.vp.scale === 1 && viewport.vp.tx === 0 && viewport.vp.ty === 0}>reset</button>
          </div>
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

function findNearest(docks: BikePoint[], wx: number, wy: number, scale: number): BikePoint | null {
  let best: BikePoint | null = null;
  const hitR = 16 / scale;
  let bestD = hitR * hitR;
  for (const d of docks) {
    if (!inBbox(d.lat, d.lon)) continue;
    const [dx, dy] = latLonToXY(d.lat, d.lon, 1200, 700);
    const dd = (dx - wx) ** 2 + (dy - wy) ** 2;
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

function draw(
  canvas: HTMLCanvasElement,
  docks: BikePoint[],
  mode: 'bikes' | 'spaces',
  vp: Viewport,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  // Clear in identity first — without this, panning leaves trails because
  // the background fill inside drawLondonBg is in world-space and no longer
  // covers the whole visible canvas once we've translated.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.tx, vp.ty);
  drawLondonBg(ctx, W, H, vp);

  // View culling for dots: skip those outside the visible world rect.
  const vmin = [(0 - vp.tx) / vp.scale, (0 - vp.ty) / vp.scale];
  const vmax = [(W - vp.tx) / vp.scale, (H - vp.ty) / vp.scale];

  for (const d of docks) {
    if (!inBbox(d.lat, d.lon)) continue;
    const [x, y] = latLonToXY(d.lat, d.lon, W, H);
    if (x < vmin[0] - 10 || x > vmax[0] + 10 || y < vmin[1] - 10 || y > vmax[1] + 10) continue;
    const c = dockColor(d, mode);
    const r = (2 + Math.min(4, Math.sqrt(d.totalDocks) / 4)) / vp.scale;

    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1 / vp.scale;
    ctx.stroke();
  }

  drawThamesOverlay(ctx, W, H, vp);
  ctx.restore();

  // Labels at identity transform so text stays crisp at any zoom level.
  drawBoroughLabels(ctx, W, H, vp);
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
  .canvas { width: 100%; height: auto; border: 1px solid var(--color-border); display: block; touch-action: none; user-select: none; }
  .vp-ctrl {
    position: absolute; top: 8px; right: 10px;
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
    background: color-mix(in oklch, var(--color-bg) 70%, transparent);
    padding: 4px 8px; border: 1px solid var(--color-border);
    pointer-events: auto;
  }
  .vp-ctrl button { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 1px 8px; font-family: inherit; font-size: inherit; cursor: pointer; text-transform: lowercase; }
  .vp-ctrl button:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .vp-ctrl button:disabled { opacity: 0.4; cursor: default; }
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
