import { Link, getRouteApi } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import type { HealthWorkout } from '../server/health';

const route = getRouteApi('/_main/health/workouts/$id');

function n(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtKm(km: number | null): string {
  if (km == null) return '—';
  return km < 10 ? km.toFixed(2) + ' km' : km.toFixed(1) + ' km';
}

/** Takes seconds (HAE's native unit for workout duration) and renders
 *  as 'Xh Ym' / 'Xh' / 'Y min' depending on size. */
function fmtDuration(secs: number | null): string {
  if (secs == null || secs <= 0) return '—';
  const min = secs / 60;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h >= 1) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${Math.round(min)} min`;
}

export default function HealthWorkoutDetailPage() {
  const workout = route.useLoaderData() as HealthWorkout | null;
  const { id } = route.useParams();

  if (!workout) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-w">
          <div className="not-found">
            <p className="t-faint">no workout matches that id.</p>
            <Link to="/health" className="t-accent">
              ← back to /health
            </Link>
          </div>
        </main>
      </>
    );
  }

  const w = workout;

  // pull common stats; HAE field shapes vary by workout type so cast
  // through Record<string, unknown> first.
  const r = w as Record<string, unknown>;
  const distance = (r.distance as { qty?: number; units?: string } | undefined)?.qty ?? null;
  const kcal = (r.activeEnergyBurned as { qty?: number } | undefined)?.qty ?? null;
  const avgHr = (r.avgHeartRate as { qty?: number } | undefined)?.qty ?? null;
  const maxHr = (r.maxHeartRate as { qty?: number } | undefined)?.qty ?? null;
  const minHr = (r.heartRate as { min?: { qty?: number } } | undefined)?.min?.qty ?? null;
  const tempC = (r.temperature as { qty?: number; units?: string } | undefined)?.qty ?? null;
  const tempUnits = (r.temperature as { qty?: number; units?: string } | undefined)?.units ?? '';
  const humidity = (r.humidity as { qty?: number } | undefined)?.qty ?? null;
  const speed = (r.speed as { qty?: number; units?: string } | undefined)?.qty ?? null;
  const speedUnits = (r.speed as { qty?: number; units?: string } | undefined)?.units ?? '';
  const intensity = (r.intensity as { qty?: number; units?: string } | undefined)?.qty ?? null;
  const stepCount =
    typeof r.stepCount === 'object' && r.stepCount != null && !Array.isArray(r.stepCount)
      ? (r.stepCount as { qty?: number }).qty ?? null
      : null;

  // heartRateData ships as [{ date, Min, Avg, Max, units, source }]
  const hrSeries = parseHrSeries(r.heartRateData);
  // route ships as [{ lat, lon, ... }] when GPS was tracked
  const routePoints = parseRoutePoints(r.route);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-w">
        <div className="lead">
          <Link to="/health" className="back-link">
            ← /health
          </Link>
          <h1>{(typeof w.name === 'string' ? w.name : 'workout').toLowerCase()}</h1>
          <div className="when">{fmtDate(typeof w.start === 'string' ? w.start : undefined)}</div>
          <div className="facts">
            {w.duration ? <span><b className="t-fg">{fmtDuration(n(w.duration))}</b></span> : null}
            {distance != null ? (
              <>
                <span className="dot">·</span>
                <span><b className="t-fg">{fmtKm(distance)}</b></span>
              </>
            ) : null}
            {kcal != null ? (
              <>
                <span className="dot">·</span>
                <span><b className="t-fg">{Math.round(kcal)}</b> kcal</span>
              </>
            ) : null}
            {avgHr != null ? (
              <>
                <span className="dot">·</span>
                <span>
                  <b className="t-fg">{Math.round(avgHr)}</b> avg{' '}
                  {maxHr != null ? <span className="t-faint">/ {Math.round(maxHr)} max</span> : null}
                  {' '}bpm
                </span>
              </>
            ) : null}
            {(typeof r.location === 'string' ? r.location : null) ? (
              <>
                <span className="dot">·</span>
                <span>{(r.location as string).toLowerCase()}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* HR curve */}
        {hrSeries.length > 1 ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">01 //</span>heart rate.
            </h2>
            <HrChart series={hrSeries} avg={avgHr} min={minHr} max={maxHr} />
          </section>
        ) : null}

        {/* route map */}
        {routePoints.length > 2 ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">02 //</span>route.
            </h2>
            <RouteShape points={routePoints} />
            <div className="t-faint route-note">
              {routePoints.length.toLocaleString()} gps waypoints · openstreetmap tiles
            </div>
          </section>
        ) : null}

        {/* extra stats */}
        <section className="section">
          <h2 className="section-hd">
            <span className="num">{routePoints.length > 2 ? '03' : hrSeries.length > 1 ? '02' : '01'} //</span>conditions.
          </h2>
          <dl className="kv">
            {intensity != null ? (
              <>
                <dt>intensity</dt>
                <dd>{intensity.toFixed(2)} kcal/hr·kg</dd>
              </>
            ) : null}
            {stepCount != null ? (
              <>
                <dt>steps</dt>
                <dd>{Math.round(stepCount).toLocaleString()}</dd>
              </>
            ) : null}
            {speed != null ? (
              <>
                <dt>speed</dt>
                <dd>{speed.toFixed(2)} {speedUnits}</dd>
              </>
            ) : null}
            {tempC != null ? (
              <>
                <dt>temperature</dt>
                <dd>{tempC.toFixed(1)} {tempUnits}</dd>
              </>
            ) : null}
            {humidity != null ? (
              <>
                <dt>humidity</dt>
                <dd>{(humidity * 100).toFixed(0)}%</dd>
              </>
            ) : null}
          </dl>
        </section>

        <footer className="w-footer">
          <span>
            src: <span className="t-accent">apple health · workout {id.slice(0, 8)}</span>
          </span>
          <span>
            ←{' '}
            <Link to="/health" className="t-accent">
              health
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function parseHrSeries(raw: unknown): Array<{ t: number; avg: number; min: number; max: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ t: number; avg: number; min: number; max: number }> = [];
  for (const p of raw as Array<Record<string, unknown>>) {
    const date = typeof p.date === 'string' ? Date.parse(p.date) : NaN;
    if (!Number.isFinite(date)) continue;
    const avg = n(p.Avg ?? p.avg);
    const min = n(p.Min ?? p.min);
    const max = n(p.Max ?? p.max);
    if (avg == null) continue;
    out.push({ t: date, avg, min: min ?? avg, max: max ?? avg });
  }
  return out.sort((a, b) => a.t - b.t);
}

function parseRoutePoints(raw: unknown): Array<{ lat: number; lon: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ lat: number; lon: number }> = [];
  for (const p of raw as Array<Record<string, unknown>>) {
    const lat = n(p.lat ?? p.latitude);
    const lon = n(p.lon ?? p.longitude);
    if (lat != null && lon != null) out.push({ lat, lon });
  }
  return out;
}

function HrChart({
  series,
  avg,
  min,
  max,
}: {
  series: Array<{ t: number; avg: number; min: number; max: number }>;
  avg: number | null;
  min: number | null;
  max: number | null;
}) {
  const W = 800;
  const H = 200;
  const pad = { top: 16, right: 16, bottom: 24, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const tMin = series[0].t;
  const tMax = series[series.length - 1].t;
  const tSpan = tMax - tMin || 1;
  const yMax = Math.max(...series.map((s) => s.max));
  const yMin = Math.min(...series.map((s) => s.min));
  const ySpan = yMax - yMin || 1;
  const yPad = ySpan * 0.1;
  const yTop = yMax + yPad;
  const yBot = Math.max(40, yMin - yPad);
  const ySpanPad = yTop - yBot;

  const xOf = (t: number) => pad.left + ((t - tMin) / tSpan) * chartW;
  const yOf = (v: number) => pad.top + (1 - (v - yBot) / ySpanPad) * chartH;

  // y-axis tick marks at ~5 round-ish bpm intervals
  const ticks: number[] = [];
  const step = ySpanPad <= 30 ? 5 : ySpanPad <= 60 ? 10 : 20;
  const start = Math.ceil(yBot / step) * step;
  for (let v = start; v <= yTop; v += step) ticks.push(v);

  const avgLine = series.map((s) => `${xOf(s.t).toFixed(1)},${yOf(s.avg).toFixed(1)}`).join(' ');
  const rangeArea = [
    ...series.map((s) => `${xOf(s.t).toFixed(1)},${yOf(s.max).toFixed(1)}`),
    ...[...series].reverse().map((s) => `${xOf(s.t).toFixed(1)},${yOf(s.min).toFixed(1)}`),
  ].join(' ');

  return (
    <div className="hr-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="hr-chart">
        {/* y grid */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="var(--color-border)"
              strokeDasharray="2 4"
              strokeWidth="0.5"
            />
            <text
              x={pad.left - 6}
              y={yOf(v) + 3}
              textAnchor="end"
              className="hr-tick"
              fill="var(--color-fg-faint)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}
        {/* min-max range fill */}
        <polygon points={rangeArea} fill="var(--color-accent)" opacity="0.12" />
        {/* avg line */}
        <polyline
          points={avgLine}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="hr-chart-meta t-faint">
        <span>avg <b className="t-fg">{avg != null ? Math.round(avg) : '—'}</b></span>
        <span className="dot">·</span>
        <span>min <b className="t-fg">{min != null ? Math.round(min) : '—'}</b></span>
        <span className="dot">·</span>
        <span>max <b className="t-fg">{max != null ? Math.round(max) : '—'}</b></span>
      </div>
    </div>
  );
}

/** Leaflet-backed route map, dynamically imported on the client only.
 *  Leaflet relies on `window`/DOM globals so it can't run during SSR;
 *  this component renders an empty placeholder server-side and wires
 *  up the map after mount. Tiles come from OSM directly (their tile-
 *  usage policy permits low-volume personal sites — if traffic grows
 *  enough to matter we'd switch to a tile-host with an SLA). */
function RouteShape({ points }: { points: Array<{ lat: number; lon: number }> }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      // Leaflet's CSS isn't bundled with the JS — pull it in at runtime
      // so we don't ship it on every page that doesn't render a map.
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        link.setAttribute('data-leaflet-css', '');
        document.head.appendChild(link);
      }
      if (cancelled || !ref.current) return;

      const latlngs = points.map((p) => [p.lat, p.lon] as [number, number]);
      const map = L.map(ref.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const line = L.polyline(latlngs, {
        color: '#6ce58a',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });

      cleanup = () => map.remove();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [points]);

  return <div ref={ref} className="route-map" />;
}

const CSS = `
  .shell-w { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .not-found {
    padding: 120px 0;
    text-align: center;
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .not-found .t-accent { display: inline-block; margin-top: var(--sp-3); }

  .lead {
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
    display: flex; flex-direction: column; gap: var(--sp-2);
  }
  .back-link {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); text-decoration: none;
  }
  .back-link:hover { color: var(--color-accent); text-decoration: none; }
  .lead h1 {
    font-family: var(--font-display);
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 500; letter-spacing: -0.02em; line-height: 1;
    color: var(--color-fg);
    text-transform: lowercase;
    margin: 0;
  }
  .when {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase; letter-spacing: 0.06em;
  }
  .facts {
    display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-top: var(--sp-2);
  }
  .facts b.t-fg { color: var(--color-fg); font-weight: 400; }
  .facts .dot { color: var(--color-fg-ghost); }

  .section {
    padding: var(--sp-6) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .section-hd {
    font-family: var(--font-display); font-size: 24px; font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    margin-bottom: var(--sp-4);
  }
  .section-hd .num {
    color: var(--color-accent); font-family: var(--font-mono);
    font-size: 13px; margin-right: 12px; letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* hr chart */
  .hr-chart-wrap { display: flex; flex-direction: column; gap: var(--sp-2); }
  .hr-chart {
    width: 100%; height: auto;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .hr-chart-meta {
    display: flex; gap: 6px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .hr-chart-meta .dot { color: var(--color-fg-ghost); }
  .hr-chart-meta b.t-fg { color: var(--color-fg); font-weight: 400; }

  /* route */
  .route-map {
    width: 100%; height: 420px;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  /* leaflet attribution sits on top of the map; tone it down to fit */
  .route-map .leaflet-control-attribution {
    background: rgba(0,0,0,0.7);
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: 9px;
  }
  .route-map .leaflet-control-attribution a { color: var(--color-accent-dim); }
  .route-note {
    margin-top: var(--sp-2);
    font-family: var(--font-mono); font-size: 10px;
  }

  /* kv list */
  .kv {
    display: grid; grid-template-columns: auto 1fr;
    gap: 8px var(--sp-3); margin: 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .kv dt { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .kv dd { color: var(--color-fg); margin: 0; }

  .w-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .w-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
