import { Link } from '@tanstack/react-router';
import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { drawWorldBg, ensureWorldLand, latLonToXY } from '../../lib/world-bg';

// "Lightning map" honest caveat: there is no free, reliable global feed of
// actual strikes. What open-meteo DOES give us is CAPE (convective available
// potential energy, J/kg) — the thermodynamic ingredient for a thunderstorm.
// CAPE > 1000 means a primed atmosphere; CAPE > 2500 means severe potential.
// We query a dense grid of cities worldwide and render hot cells as bright
// dots. It's a storm-risk map, not a strike feed — which is the honest thing
// we can ship without a data-license deal.

// ~140 points spread across land (major cities + gaps filled). Fewer than
// 150 keeps us comfortably inside open-meteo's free-tier quota even when
// multiple users hit the lab simultaneously.
const POINTS: [number, number, string][] = [
  [51.5, -0.1, 'london'], [40.7, -74.0, 'new york'], [35.7, 139.7, 'tokyo'], [-33.9, 151.2, 'sydney'],
  [-23.5, -46.6, 'são paulo'], [19.4, -99.1, 'mexico city'], [28.6, 77.2, 'delhi'], [31.2, 121.5, 'shanghai'],
  [55.8, 37.6, 'moscow'], [-34.6, -58.4, 'buenos aires'], [30.0, 31.2, 'cairo'], [1.4, 103.8, 'singapore'],
  [34.1, -118.2, 'los angeles'], [43.7, -79.4, 'toronto'], [-1.3, 36.8, 'nairobi'], [45.5, -73.6, 'montreal'],
  [41.9, 12.5, 'rome'], [48.9, 2.3, 'paris'], [52.5, 13.4, 'berlin'], [40.4, -3.7, 'madrid'],
  [25.2, 55.3, 'dubai'], [13.7, 100.5, 'bangkok'], [-26.2, 28.0, 'jo\'burg'], [37.6, 127.0, 'seoul'],
  [41.0, 29.0, 'istanbul'], [-6.2, 106.8, 'jakarta'], [14.6, 121.0, 'manila'], [6.5, 3.4, 'lagos'],
  [59.3, 18.1, 'stockholm'], [55.7, 12.6, 'copenhagen'], [60.2, 24.9, 'helsinki'], [59.9, 30.3, 'st petersburg'],
  [50.1, 8.7, 'frankfurt'], [47.4, 8.5, 'zurich'], [50.8, 4.4, 'brussels'], [52.4, 4.9, 'amsterdam'],
  [53.3, -6.3, 'dublin'], [55.9, -3.2, 'edinburgh'], [38.7, -9.1, 'lisbon'], [37.9, 23.7, 'athens'],
  [45.4, 12.3, 'venice'], [48.1, 11.6, 'munich'], [47.5, 19.0, 'budapest'], [50.1, 14.4, 'prague'],
  [52.2, 21.0, 'warsaw'], [39.9, 116.4, 'beijing'], [22.3, 114.2, 'hong kong'], [24.2, 120.6, 'taipei'],
  [12.9, 77.6, 'bangalore'], [19.1, 72.9, 'mumbai'], [22.6, 88.4, 'kolkata'], [13.1, 80.3, 'chennai'],
  [24.9, 67.0, 'karachi'], [33.7, 73.0, 'islamabad'], [31.5, 74.4, 'lahore'], [34.5, 69.2, 'kabul'],
  [35.7, 51.4, 'tehran'], [33.3, 44.4, 'baghdad'], [33.5, 36.3, 'damascus'], [31.8, 35.2, 'jerusalem'],
  [24.7, 46.7, 'riyadh'], [21.4, 39.8, 'mecca'], [15.3, 44.2, 'sanaa'], [9.0, 38.8, 'addis ababa'],
  [-4.0, 39.7, 'mombasa'], [-15.4, 28.3, 'lusaka'], [-17.8, 31.0, 'harare'], [-25.7, 28.2, 'pretoria'],
  [-33.9, 18.4, 'cape town'], [14.7, -17.5, 'dakar'], [5.6, -0.2, 'accra'], [9.1, 7.5, 'abuja'],
  [3.9, 11.5, 'yaoundé'], [-4.3, 15.3, 'kinshasa'], [-8.8, 13.2, 'luanda'], [0.3, 32.6, 'kampala'],
  [-3.4, 29.4, 'bujumbura'], [39.1, -84.5, 'cincinnati'], [41.9, -87.6, 'chicago'], [39.7, -104.9, 'denver'],
  [47.6, -122.3, 'seattle'], [37.8, -122.4, 'san francisco'], [32.7, -117.2, 'san diego'], [32.8, -96.8, 'dallas'],
  [29.8, -95.4, 'houston'], [25.8, -80.2, 'miami'], [35.8, -78.7, 'raleigh'], [42.4, -71.1, 'boston'],
  [39.3, -76.6, 'baltimore'], [44.7, -93.3, 'minneapolis'], [36.2, -115.1, 'las vegas'], [33.5, -112.1, 'phoenix'],
  [49.3, -123.1, 'vancouver'], [51.0, -114.1, 'calgary'], [53.5, -113.5, 'edmonton'], [46.8, -71.2, 'quebec city'],
  [23.1, -82.4, 'havana'], [18.5, -66.1, 'san juan'], [14.6, -90.5, 'guatemala'], [9.9, -84.1, 'san jose cr'],
  [8.0, -79.5, 'panama'], [10.5, -66.9, 'caracas'], [4.7, -74.1, 'bogotá'], [-0.2, -78.5, 'quito'],
  [-12.1, -77.0, 'lima'], [-16.5, -68.1, 'la paz'], [-33.5, -70.7, 'santiago'], [-25.3, -57.6, 'asunción'],
  [-22.9, -43.2, 'rio'], [-12.9, -38.5, 'salvador'], [-8.0, -34.9, 'recife'], [-30.0, -51.2, 'porto alegre'],
  [-37.8, 144.9, 'melbourne'], [-31.9, 115.8, 'perth'], [-27.5, 153.0, 'brisbane'], [-34.9, 138.6, 'adelaide'],
  [-36.9, 174.8, 'auckland'], [-41.3, 174.8, 'wellington'], [-45.0, 168.7, 'queenstown'], [21.3, -157.9, 'honolulu'],
  [64.1, -21.9, 'reykjavík'], [69.7, 18.9, 'tromsø'], [71.2, -156.8, 'utqiaġvik'], [-54.8, -68.3, 'ushuaia'],
  [68.9, 33.1, 'murmansk'], [56.8, 60.6, 'yekaterinburg'], [55.0, 82.9, 'novosibirsk'], [52.3, 104.3, 'irkutsk'],
  [43.1, 131.9, 'vladivostok'], [62.0, 129.7, 'yakutsk'], [67.5, 133.4, 'oymyakon'],
];

type CellResult = { name: string; lat: number; lon: number; cape: number } | null;

async function fetchCell(lat: number, lon: number, name: string, signal?: AbortSignal): Promise<CellResult> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cape`;
  const r = await fetch(url, { signal });
  if (!r.ok) return null;
  const j = (await r.json()) as { current?: { cape?: number } };
  return { name, lat, lon, cape: j.current?.cape ?? 0 };
}

function capeLabel(cape: number): string {
  if (cape < 300) return 'stable';
  if (cape < 1000) return 'marginal';
  if (cape < 2500) return 'primed';
  return 'severe';
}

export default function LightningPage() {
  const queries = useQueries({
    queries: POINTS.map(([lat, lon, name]) => ({
      queryKey: ['lightning', name],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchCell(lat, lon, name, signal),
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
    })),
  });

  const results = useMemo(() => queries.map((q) => q.data).filter((d): d is NonNullable<CellResult> => !!d), [queries]);
  const loaded = queries.filter((q) => q.data !== undefined).length;
  const hottest = useMemo(() => [...results].sort((a, b) => b.cape - a.cape).slice(0, 12), [results]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<CellResult | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    draw(canvasRef.current, results);
  }, [results]);

  // Kick off the coastline fetch on mount, then repaint once it lands.
  useEffect(() => {
    ensureWorldLand().then(() => {
      if (canvasRef.current) draw(canvasRef.current, results);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lightning">
        <header className="page-hd">
          <div className="label">~/labs/lightning</div>
          <h1>lightning<span className="dot">.</span></h1>
          <p className="sub">
            global thunderstorm risk map. for a dense grid of cities we pull <code>cape</code>
            (convective available potential energy) from open-meteo. &gt; 1000 j/kg means the
            atmosphere is primed; &gt; 2500 is severe. refreshes every five minutes. not a
            live strike feed — those aren&apos;t free at global scale.
          </p>
          <div className="score-row">
            <span>loaded · <b>{loaded}</b> of {POINTS.length} cells</span>
            <span className="ln-dot" />
          </div>
        </header>

        <section className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={1200}
            height={600}
            className="canvas"
            onMouseMove={(e) => {
              const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 1200;
              const y = ((e.clientY - rect.top) / rect.height) * 600;
              setHover(findNearest(results, x, y));
            }}
            onMouseLeave={() => setHover(null)}
          />
          {hover ? (
            <div className="tip">
              <b>{hover.name}</b>
              <span>cape · {Math.round(hover.cape)} j/kg</span>
              <span>{capeLabel(hover.cape)}</span>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-hd">hottest cells · convective available potential energy</div>
          <table className="hot">
            <tbody>
              {hottest.map((h, i) => (
                <tr key={i}>
                  <td className="rank">#{i + 1}</td>
                  <td className="name">{h.name}</td>
                  <td className="val">
                    <span className="bar" style={{ width: `${Math.min(100, (h.cape / 3000) * 100)}%` }} />
                    <span className="num">{Math.round(h.cape).toLocaleString()} j/kg</span>
                  </td>
                  <td className="cape">{capeLabel(h.cape)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="labs-footer">
          <span>source · <span className="t-accent">open-meteo forecast · cape + lpi</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function findNearest(results: NonNullable<CellResult>[], x: number, y: number): CellResult | null {
  let best: NonNullable<CellResult> | null = null;
  let bestD = 30 * 30;
  for (const r of results) {
    const [rx, ry] = latLonToXY(r.lat, r.lon, 1200, 600);
    const d = (rx - x) ** 2 + (ry - y) ** 2;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

function draw(canvas: HTMLCanvasElement, results: NonNullable<CellResult>[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  drawWorldBg(ctx, W, H);

  // cells — colour shifts from pale yellow → orange → red as CAPE climbs.
  // Saturation scales with potential so stable atmospheres fade into the map
  // rather than dominating it.
  for (const r of results) {
    const [x, y] = latLonToXY(r.lat, r.lon, W, H);
    const cape = Math.max(0, Math.min(3000, r.cape));
    const intensity = cape / 3000;

    const radius = 6 + intensity * 26;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const hue = 60 - intensity * 60; // yellow → red
    grad.addColorStop(0, `hsla(${hue}, 100%, 60%, ${0.18 + intensity * 0.65})`);
    grad.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsl(${hue}, 100%, ${60 + intensity * 15}%)`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + intensity * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const CSS = `
  .shell-lightning { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); }
  .page-hd code { font-family: var(--font-mono); color: var(--color-accent); font-size: 0.9em; }

  .score-row { margin-top: var(--sp-4); display: flex; align-items: center; gap: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .score-row b { color: var(--color-accent); font-weight: 400; }
  .ln-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 8px var(--color-accent); animation: ln-blink 2s ease-in-out infinite; }
  @keyframes ln-blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.4); } }

  .canvas-wrap { margin-top: var(--sp-4); position: relative; }
  .canvas { width: 100%; height: auto; border: 1px solid var(--color-border); display: block; }
  .tip {
    position: absolute; top: 10px; left: 12px;
    background: color-mix(in oklch, var(--color-bg) 92%, transparent);
    border: 1px solid var(--color-accent-dim);
    padding: 6px 10px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    display: flex; flex-direction: column; gap: 2px;
  }
  .tip b { color: var(--color-accent); font-weight: 400; }
  .tip span { color: var(--color-fg-dim); }

  .panel { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .panel-hd { padding: 10px var(--sp-4); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); letter-spacing: 0.08em; text-transform: uppercase; }
  .hot { width: 100%; border-collapse: collapse; }
  .hot td { padding: 6px var(--sp-4); border-bottom: 1px dashed var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .hot tr:last-child td { border-bottom: 0; }
  .rank { color: var(--color-fg-faint); width: 40px; }
  .name { color: var(--color-fg); text-transform: capitalize; }
  .val { position: relative; width: 50%; }
  .val .bar { display: block; height: 8px; background: var(--color-accent); box-shadow: 0 0 6px color-mix(in oklch, var(--color-accent) 40%, transparent); }
  .val .num { color: var(--color-accent); padding-top: 2px; display: block; }
  .cape { color: var(--color-fg-dim); text-align: right; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
