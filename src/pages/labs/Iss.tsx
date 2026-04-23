import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { drawWorldBg, ensureWorldLand, latLonToXY } from '../../lib/world-bg';

// wheretheiss.at: free, no key, reports lat/lon/alt/velocity/solar phase for
// norad 25544 (international space station). Their data comes from TLEs so
// accuracy is ~few km; good enough for a live visual.
type IssData = {
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/h
  visibility: 'daylight' | 'eclipsed';
  timestamp: number;
};

async function fetchIss(): Promise<IssData> {
  const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
}

export default function IssPage() {
  const q = useQuery({
    queryKey: ['iss-now'],
    queryFn: fetchIss,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!q.data || !canvasRef.current) return;
    draw(canvasRef.current, q.data);
  }, [q.data]);

  // Kick off the coastline fetch on mount, then repaint once it lands.
  useEffect(() => {
    ensureWorldLand().then(() => {
      if (q.data && canvasRef.current) draw(canvasRef.current, q.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-iss">
        <header className="page-hd">
          <div className="label">~/labs/iss</div>
          <h1>iss<span className="dot">.</span></h1>
          <p className="sub">
            live position of the international space station. tle-derived coordinates from wheretheiss.at,
            refreshed every five seconds. the orbit line is computed from ground speed and inclination.
          </p>
        </header>

        <section className="stats">
          <div className="stat"><span className="k">latitude</span><b>{q.data ? q.data.latitude.toFixed(4) + '°' : '—'}</b></div>
          <div className="stat"><span className="k">longitude</span><b>{q.data ? q.data.longitude.toFixed(4) + '°' : '—'}</b></div>
          <div className="stat"><span className="k">altitude</span><b>{q.data ? q.data.altitude.toFixed(1) + ' km' : '—'}</b></div>
          <div className="stat"><span className="k">velocity</span><b>{q.data ? Math.round(q.data.velocity).toLocaleString() + ' km/h' : '—'}</b></div>
          <div className="stat">
            <span className="k">sunlight</span>
            <b className={q.data?.visibility === 'daylight' ? 't-accent' : 't-faint'}>
              {q.data?.visibility ?? '—'}
            </b>
          </div>
        </section>

        <section className="canvas-wrap">
          <canvas ref={canvasRef} width={1200} height={600} className="canvas" />
          <div className="cx-legend">
            <span className="iss-dot" /> live · refreshed every 5s
          </div>
        </section>

        {q.isError ? (
          <div className="err">could not reach wheretheiss.at — check connection or try again shortly.</div>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">wheretheiss.at · norad 25544</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function draw(canvas: HTMLCanvasElement, data: IssData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  drawWorldBg(ctx, W, H);

  // iss position
  const [ix, iy] = latLonToXY(data.latitude, data.longitude, W, H);
  // glow
  const grad = ctx.createRadialGradient(ix, iy, 0, ix, iy, 40);
  grad.addColorStop(0, 'rgba(106, 234, 160, 0.6)');
  grad.addColorStop(1, 'rgba(106, 234, 160, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ix, iy, 40, 0, Math.PI * 2);
  ctx.fill();
  // core
  ctx.fillStyle = '#6aeaa0';
  ctx.beginPath();
  ctx.arc(ix, iy, 6, 0, Math.PI * 2);
  ctx.fill();
  // crosshair
  ctx.strokeStyle = 'rgba(106, 234, 160, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ix - 18, iy); ctx.lineTo(ix + 18, iy);
  ctx.moveTo(ix, iy - 18); ctx.lineTo(ix, iy + 18);
  ctx.stroke();

  // label
  ctx.fillStyle = '#6aeaa0';
  ctx.font = '12px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText(`ISS · ${data.latitude.toFixed(2)}° ${data.longitude.toFixed(2)}°`, ix + 14, iy - 14);
}

const CSS = `
  .shell-iss { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .stats { margin-top: var(--sp-5); display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stat .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); color: var(--color-fg); }

  .canvas-wrap { margin-top: var(--sp-4); position: relative; }
  .canvas { width: 100%; height: auto; border: 1px solid var(--color-border); display: block; }
  .cx-legend { position: absolute; top: 10px; right: 12px; font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); display: inline-flex; align-items: center; gap: 6px; }
  .iss-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 8px var(--color-accent);
    animation: iss-blink 2s ease-in-out infinite;
  }
  @keyframes iss-blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.4); } }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); background: color-mix(in oklch, var(--color-alert) 6%, transparent); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
