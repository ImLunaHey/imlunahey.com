import { Link, getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';
import type { HealthSnapshot } from '../server/health';

const route = getRouteApi('/_main/health/sleep');

type SleepNight = {
  date: Date;
  asleep: number | null;
  inBed: number | null;
  deep: number | null;
  rem: number | null;
  core: number | null;
  awake: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function fmtHours(h: number | null): string {
  if (h == null) return '—';
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function HealthSleepPage() {
  const snap = route.useLoaderData() as HealthSnapshot | null;

  const nights = useMemo<SleepNight[]>(() => {
    if (!snap) return [];
    const sleep = snap.metrics.find((m) => m.name.toLowerCase() === 'sleep_analysis');
    if (!sleep) return [];
    const out: SleepNight[] = [];
    for (const p of sleep.data) {
      if (typeof p.date !== 'string') continue;
      const ms = Date.parse(p.date);
      if (!Number.isFinite(ms)) continue;
      // newer Apple Watch recordings put 0 in legacy `asleep` and split
      // the time across stages — prefer totalSleep, then stage sum.
      const core = num(p.core);
      const deep = num(p.deep);
      const rem = num(p.rem);
      const stages = [core, deep, rem].filter((v): v is number => v != null);
      const stageSum = stages.length > 0 ? stages.reduce((a, b) => a + b, 0) : null;
      const totalSleep = num(p.totalSleep);
      const legacyAsleep = num(p.asleep);
      const asleep =
        (totalSleep != null && totalSleep > 0 && totalSleep) ||
        (stageSum != null && stageSum > 0 && stageSum) ||
        legacyAsleep;
      out.push({
        date: new Date(ms),
        asleep,
        inBed: num(p.inBed),
        deep,
        rem,
        core,
        awake: num(p.awake),
      });
    }
    return out.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [snap]);

  const stats = useMemo(() => {
    if (nights.length === 0) return null;
    const valid = nights.filter((n) => (n.asleep ?? 0) > 0);
    const total = valid.reduce((s, n) => s + (n.asleep ?? 0), 0);
    const avg = total / valid.length;
    const longest = valid.reduce((m, n) => Math.max(m, n.asleep ?? 0), 0);
    const shortest = valid.reduce((m, n) => Math.min(m, n.asleep ?? Infinity), Infinity);
    return { total, avg, longest, shortest, count: valid.length };
  }, [nights]);

  // Weekly averages — used for the trend line. Keys are ISO week as
  // 'YYYY-Wnn'; for display we just use the start-of-week date.
  const weekly = useMemo(() => {
    if (nights.length === 0) return [];
    const byWeek = new Map<string, { sum: number; count: number; weekStart: Date }>();
    for (const n of nights) {
      if ((n.asleep ?? 0) <= 0) continue;
      const ws = startOfWeek(n.date);
      const key = isoDay(ws);
      const entry = byWeek.get(key);
      if (entry) {
        entry.sum += n.asleep ?? 0;
        entry.count++;
      } else {
        byWeek.set(key, { sum: n.asleep ?? 0, count: 1, weekStart: ws });
      }
    }
    return [...byWeek.values()]
      .map((e) => ({ weekStart: e.weekStart, avg: e.sum / e.count }))
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [nights]);

  if (!snap || nights.length === 0) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-s">
          <div className="lead">
            <Link to="/health" className="back-link">
              ← /health
            </Link>
            <h1>sleep<span className="dot">.</span></h1>
            <p className="t-faint">no sleep entries in the snapshot.</p>
          </div>
        </main>
      </>
    );
  }

  // Last 60 nights for the bar chart — newest on the right so eye
  // moves left-to-right through time naturally.
  const last60 = nights.slice(0, 60).reverse();

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-s">
        <div className="lead">
          <Link to="/health" className="back-link">
            ← /health
          </Link>
          <h1>sleep<span className="dot">.</span></h1>
          <p className="sub">
            {stats ? (
              <>
                {stats.count} nights tracked across the last {snap.months.length} months. averaging{' '}
                <b className="t-fg">{fmtHours(stats.avg)}</b> per night.
              </>
            ) : null}
          </p>
        </div>

        {stats ? (
          <section className="stats-strip">
            <Stat label="avg" value={fmtHours(stats.avg)} />
            <Stat label="longest" value={fmtHours(stats.longest)} />
            <Stat label="shortest" value={fmtHours(stats.shortest)} />
            <Stat label="total tracked" value={`${(stats.total / 24).toFixed(1)} days`} />
          </section>
        ) : null}

        {last60.length > 1 ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">01 //</span>last 60 nights.
            </h2>
            <NightsChart nights={last60} />
          </section>
        ) : null}

        {weekly.length > 1 ? (
          <section className="section">
            <h2 className="section-hd">
              <span className="num">02 //</span>weekly average.
            </h2>
            <WeeklyChart weeks={weekly} />
          </section>
        ) : null}

        <section className="section">
          <h2 className="section-hd">
            <span className="num">03 //</span>recent nights.
          </h2>
          <table className="nights-table">
            <thead>
              <tr>
                <th>date</th>
                <th>asleep</th>
                <th>in bed</th>
                <th>deep</th>
                <th>rem</th>
                <th>core</th>
                <th>awake</th>
              </tr>
            </thead>
            <tbody>
              {nights.slice(0, 30).map((n) => (
                <tr key={isoDay(n.date)}>
                  <td>{fmtDate(n.date)}</td>
                  <td className="t-fg">{fmtHours(n.asleep)}</td>
                  <td>{fmtHours(n.inBed)}</td>
                  <td>{fmtHours(n.deep)}</td>
                  <td>{fmtHours(n.rem)}</td>
                  <td>{fmtHours(n.core)}</td>
                  <td>{fmtHours(n.awake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="s-footer">
          <span>
            src: <span className="t-accent">apple health · sleep_analysis · {nights.length} nights in window</span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = out.getDay(); // 0=Sun
  // monday-anchored weeks (closer to ISO weeks)
  const offset = (dow + 6) % 7;
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - offset);
  return out;
}

function NightsChart({ nights }: { nights: SleepNight[] }) {
  const W = 800;
  const H = 200;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const valid = nights.filter((n) => (n.asleep ?? 0) > 0);
  if (valid.length === 0) return null;
  const yMax = Math.max(12, Math.ceil(Math.max(...valid.map((n) => n.asleep ?? 0))));
  const barW = chartW / nights.length;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="sleep-chart">
        {/* y grid every 2 hours */}
        {[2, 4, 6, 8, 10, 12].filter((v) => v <= yMax).map((v) => {
          const y = pad.top + (1 - v / yMax) * chartH;
          return (
            <g key={v}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray="2 4"
                strokeWidth="0.5"
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                fill="var(--color-fg-faint)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {v}h
              </text>
            </g>
          );
        })}
        {/* bars */}
        {nights.map((n, i) => {
          const v = n.asleep ?? 0;
          if (v <= 0) return null;
          const h = (v / yMax) * chartH;
          const x = pad.left + i * barW;
          const y = pad.top + chartH - h;
          return (
            <rect
              key={isoDay(n.date)}
              x={x + 0.5}
              y={y}
              width={Math.max(1, barW - 1)}
              height={h}
              fill="var(--color-accent)"
              opacity="0.85"
            >
              <title>
                {fmtDate(n.date)}: {fmtHours(v)}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function WeeklyChart({ weeks }: { weeks: Array<{ weekStart: Date; avg: number }> }) {
  const W = 800;
  const H = 160;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const yMax = Math.max(10, Math.ceil(Math.max(...weeks.map((w) => w.avg))));

  const tMin = weeks[0].weekStart.getTime();
  const tMax = weeks[weeks.length - 1].weekStart.getTime();
  const tSpan = tMax - tMin || 1;

  const xOf = (t: number) => pad.left + ((t - tMin) / tSpan) * chartW;
  const yOf = (v: number) => pad.top + (1 - v / yMax) * chartH;

  const path = weeks
    .map((w) => `${xOf(w.weekStart.getTime()).toFixed(1)},${yOf(w.avg).toFixed(1)}`)
    .join(' ');

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="sleep-chart">
        {[2, 4, 6, 8, 10].filter((v) => v <= yMax).map((v) => {
          const y = pad.top + (1 - v / yMax) * chartH;
          return (
            <g key={v}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray="2 4"
                strokeWidth="0.5"
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                fill="var(--color-fg-faint)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {v}h
              </text>
            </g>
          );
        })}
        <polyline
          points={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

const CSS = `
  .shell-s { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .lead {
    padding: 64px 0 var(--sp-5);
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
    font-size: clamp(56px, 9vw, 96px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg); margin: 0;
  }
  .lead h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .lead .sub { color: var(--color-fg-dim); margin-top: var(--sp-3); }
  .lead .sub b.t-fg { color: var(--color-fg); font-weight: 400; }

  .stats-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-3);
    padding: var(--sp-5) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .stat {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-3);
  }
  .stat-label {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .stat-value {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--color-fg);
    margin-top: 4px;
    letter-spacing: -0.02em;
  }

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

  .chart-wrap { display: block; }
  .sleep-chart {
    width: 100%; height: auto;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }

  .nights-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .nights-table th, .nights-table td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px dashed var(--color-border);
  }
  .nights-table th {
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.1em;
    font-size: 10px;
    font-weight: 400;
  }
  .nights-table td { color: var(--color-fg-dim); }
  .nights-table td.t-fg { color: var(--color-fg); }

  .s-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .stats-strip { grid-template-columns: repeat(2, 1fr); }
    .nights-table { font-size: 10px; }
    .s-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
