import { Link, getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';
import type {
  HealthMetric,
  HealthMetricPoint,
  HealthSnapshot,
  HealthWorkout,
} from '../server/health';

const route = getRouteApi('/_main/health');

// Renderer is intentionally tolerant of HAE's many possible metric
// names — the user picks which metrics to enable in the iOS app, so
// the page should render whatever's there and gracefully skip what
// isn't. We probe by name + fall back to an empty state per panel.

function findMetric(metrics: HealthMetric[], names: string[]): HealthMetric | null {
  for (const m of metrics) {
    if (names.includes(m.name.toLowerCase())) return m;
  }
  return null;
}

function num(v: HealthMetricPoint[keyof HealthMetricPoint]): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dateOf(p: HealthMetricPoint): Date | null {
  if (!p.date || typeof p.date !== 'string') return null;
  const ms = Date.parse(p.date);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function fmtAge(ts: number): string {
  const dt = (Date.now() - ts) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

function fmtHours(h: number | null): string {
  if (h == null) return '—';
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function fmtKm(km: number | null): string {
  if (km == null) return '—';
  return km < 10 ? km.toFixed(2) + ' km' : km.toFixed(1) + ' km';
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function HealthPage() {
  const snap = route.useLoaderData() as HealthSnapshot | null;

  const metrics = snap?.metrics ?? [];

  const stepMetric = findMetric(metrics, ['step_count', 'steps']);
  const sleepMetric = findMetric(metrics, ['sleep_analysis', 'sleep']);
  const energyMetric = findMetric(metrics, ['active_energy', 'active_energy_burned']);
  const heartRestMetric = findMetric(metrics, ['resting_heart_rate']);

  const todaySteps = useMemo(() => {
    if (!stepMetric) return null;
    const today = stepMetric.data
      .filter((p) => {
        const d = dateOf(p);
        return d ? isToday(d) : false;
      })
      .reduce((sum, p) => sum + (num(p.qty) ?? 0), 0);
    if (today > 0) return { value: today, day: 'today' as const };
    const last = stepMetric.data
      .map((p) => ({ p, d: dateOf(p) }))
      .filter((x): x is { p: HealthMetricPoint; d: Date } => x.d != null)
      .sort((a, b) => b.d.getTime() - a.d.getTime())[0];
    if (!last) return null;
    return { value: num(last.p.qty) ?? 0, day: fmtDay(last.d) };
  }, [stepMetric]);

  const lastSleep = useMemo(() => {
    if (!sleepMetric) return null;
    const sorted = sleepMetric.data
      .map((p) => ({ p, d: dateOf(p) }))
      .filter((x): x is { p: HealthMetricPoint; d: Date } => x.d != null)
      .sort((a, b) => b.d.getTime() - a.d.getTime());
    const latest = sorted[0];
    if (!latest) return null;
    const p = latest.p;
    return {
      asleep: num(p.asleep),
      inBed: num(p.inBed),
      deep: num(p.deep),
      rem: num(p.rem),
      core: num(p.core),
      awake: num(p.awake),
      day: fmtDay(latest.d),
    };
  }, [sleepMetric]);

  const stepHistory = useMemo(() => {
    if (!stepMetric) return [];
    const byDay = new Map<string, number>();
    for (const p of stepMetric.data) {
      const d = dateOf(p);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + (num(p.qty) ?? 0));
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([day, qty]) => ({ day, qty }));
  }, [stepMetric]);

  const recentWorkouts = useMemo(() => {
    return [...(snap?.workouts ?? [])]
      .sort((a, b) => {
        const at = a.start ? Date.parse(a.start as string) : 0;
        const bt = b.start ? Date.parse(b.start as string) : 0;
        return bt - at;
      })
      .slice(0, 12);
  }, [snap?.workouts]);

  const restingHr = useMemo(() => {
    if (!heartRestMetric) return null;
    const sorted = heartRestMetric.data
      .map((p) => ({ p, d: dateOf(p) }))
      .filter((x): x is { p: HealthMetricPoint; d: Date } => x.d != null)
      .sort((a, b) => b.d.getTime() - a.d.getTime());
    const latest = sorted[0];
    return latest ? num(latest.p.qty) : null;
  }, [heartRestMetric]);

  const todayEnergy = useMemo(() => {
    if (!energyMetric) return null;
    const today = energyMetric.data
      .filter((p) => {
        const d = dateOf(p);
        return d ? isToday(d) : false;
      })
      .reduce((sum, p) => sum + (num(p.qty) ?? 0), 0);
    return today > 0 ? Math.round(today) : null;
  }, [energyMetric]);

  if (!snap) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-h">
          <header className="page-hd">
            <div className="label" style={{ marginBottom: 8 }}>
              ~/health
            </div>
            <h1>
              health<span className="dot">.</span>
            </h1>
            <p className="sub">
              live apple health snapshot pushed from the{' '}
              <a href="https://www.healthexportapp.com/" target="_blank" rel="noopener noreferrer">
                health auto export
              </a>{' '}
              ios app on a schedule. currently empty: nothing has been pushed to{' '}
              <code className="inline">/api/health</code> yet, or <code className="inline">HEALTH_TOKEN</code>{' '}
              isn&apos;t set on the worker.
            </p>
          </header>
          <footer className="h-footer">
            <span>
              src: <span className="t-accent">health auto export · unconfigured</span>
            </span>
            <span>
              ←{' '}
              <Link to="/" className="t-accent">
                home
              </Link>
            </span>
          </footer>
        </main>
      </>
    );
  }

  const maxStep = stepHistory.reduce((m, s) => Math.max(m, s.qty), 0);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-h">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/health
          </div>
          <h1>
            health<span className="dot">.</span>
          </h1>
          <p className="sub">
            apple health, on a schedule. pushed by{' '}
            <a href="https://www.healthexportapp.com/" target="_blank" rel="noopener noreferrer">
              health auto export
            </a>{' '}
            from my phone — sleep, steps, workouts, resting heart rate. snapshot is whatever the last push
            contained; older history depends on the rolling window configured in the app.
          </p>
          <div className="meta">
            <span>
              metrics <b className="t-accent">{metrics.length}</b>
            </span>
            <span>
              workouts <b className="t-accent">{snap.workouts.length}</b>
            </span>
            <span className="t-faint">
              snapshot <b>{fmtAge(snap.ts)}</b>
            </span>
          </div>
        </header>

        <section className="bento">
          <div className="panel c-sleep">
            <div className="panel-hd">
              <span className="ttl">sleep</span>
              <span className="src-tag">{lastSleep?.day ?? 'no data'}</span>
            </div>
            {lastSleep ? (
              <>
                <div className="big-num">
                  <span className="num-val">{fmtHours(lastSleep.asleep ?? lastSleep.inBed)}</span>
                  <span className="num-unit">asleep</span>
                </div>
                <dl className="bk-dl">
                  {lastSleep.inBed != null ? (
                    <>
                      <dt>in bed</dt>
                      <dd>{fmtHours(lastSleep.inBed)}</dd>
                    </>
                  ) : null}
                  {lastSleep.deep != null ? (
                    <>
                      <dt>deep</dt>
                      <dd>{fmtHours(lastSleep.deep)}</dd>
                    </>
                  ) : null}
                  {lastSleep.rem != null ? (
                    <>
                      <dt>rem</dt>
                      <dd>{fmtHours(lastSleep.rem)}</dd>
                    </>
                  ) : null}
                  {lastSleep.core != null ? (
                    <>
                      <dt>core</dt>
                      <dd>{fmtHours(lastSleep.core)}</dd>
                    </>
                  ) : null}
                  {lastSleep.awake != null ? (
                    <>
                      <dt>awake</dt>
                      <dd>{fmtHours(lastSleep.awake)}</dd>
                    </>
                  ) : null}
                </dl>
              </>
            ) : (
              <div className="t-faint">no sleep entries in the snapshot.</div>
            )}
          </div>

          <div className="panel c-steps">
            <div className="panel-hd">
              <span className="ttl">steps</span>
              <span className="src-tag">{todaySteps?.day ?? '—'}</span>
            </div>
            {todaySteps ? (
              <>
                <div className="big-num">
                  <span className="num-val">{Math.round(todaySteps.value).toLocaleString()}</span>
                  <span className="num-unit">steps</span>
                </div>
                {stepHistory.length > 1 ? (
                  <div className="sparkline">
                    {stepHistory.map(({ day, qty }) => {
                      const h = maxStep > 0 ? Math.max(2, (qty / maxStep) * 48) : 2;
                      const dayLabel = new Date(day + 'T12:00:00Z').toLocaleDateString(
                        'en-GB',
                        { weekday: 'short' },
                      );
                      return (
                        <div key={day} className="spark-bar" title={`${dayLabel}: ${qty.toLocaleString()}`}>
                          <div className="spark-fill" style={{ height: `${h}px` }} />
                          <span className="spark-label">{dayLabel.slice(0, 1)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="t-faint">no step data.</div>
            )}
          </div>

          <div className="panel c-vitals">
            <div className="panel-hd">
              <span className="ttl">vitals</span>
              <span className="src-tag">latest</span>
            </div>
            <dl className="bk-dl">
              <dt>resting hr</dt>
              <dd>{restingHr != null ? <b>{Math.round(restingHr)} bpm</b> : '—'}</dd>
              <dt>active energy</dt>
              <dd>{todayEnergy != null ? <b>{todayEnergy} kcal</b> : '—'}</dd>
            </dl>
          </div>
        </section>

        <div className="section-hd">
          <h2>
            <span className="num">02 //</span>workouts.
          </h2>
          <span className="src">most recent first</span>
        </div>
        <section className="workouts">
          {recentWorkouts.length === 0 ? (
            <div className="empty">no workouts in the snapshot.</div>
          ) : (
            recentWorkouts.map((w, i) => <WorkoutRow key={i} w={w} />)
          )}
        </section>

        <footer className="h-footer">
          <span>
            src: <span className="t-accent">health auto export → kv → this page</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function WorkoutRow({ w }: { w: HealthWorkout }) {
  const start = w.start ? new Date(w.start as string) : null;
  const km = w.distance?.qty ?? null;
  const kcal = w.activeEnergyBurned?.qty ?? null;
  return (
    <article className="workout">
      <div className="workout-when">
        {start ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
      </div>
      <div className="workout-body">
        <div className="workout-name">{(w.name ?? 'workout').toLowerCase()}</div>
        <div className="workout-meta t-faint">
          {w.duration ? <span>{Math.round(w.duration)} min</span> : null}
          {km != null ? (
            <>
              {w.duration ? <span className="dot">·</span> : null}
              <span>{fmtKm(km)}</span>
            </>
          ) : null}
          {kcal != null ? (
            <>
              <span className="dot">·</span>
              <span>{Math.round(kcal)} kcal</span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const CSS = `
  .shell-h { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub a { color: var(--color-accent); }
  .page-hd .sub code.inline {
    color: var(--color-accent);
    font-family: var(--font-mono); font-size: 0.95em;
    padding: 0 4px;
    background: var(--color-bg-raised);
  }
  .page-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  .section-hd {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: var(--sp-6) 0 var(--sp-3);
  }
  .section-hd h2 {
    font-family: var(--font-display); font-size: 24px; font-weight: 500;
    color: var(--color-fg); letter-spacing: -0.02em;
  }
  .section-hd h2 .num {
    color: var(--color-accent); font-family: var(--font-mono);
    font-size: 13px; margin-right: 12px; letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .section-hd .src { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--sp-3);
    padding: var(--sp-5) 0;
  }
  .bento .panel {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-3);
  }
  .panel-hd {
    display: flex; justify-content: space-between;
    font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.14em;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--color-border);
  }
  .panel-hd .ttl { color: var(--color-accent); }
  .panel-hd .src-tag { color: var(--color-fg-faint); }
  .c-sleep { grid-column: span 5; }
  .c-steps { grid-column: span 4; }
  .c-vitals { grid-column: span 3; }

  .big-num { display: flex; align-items: baseline; gap: 6px; }
  .big-num .num-val {
    font-family: var(--font-display); font-size: 44px; line-height: 1;
    color: var(--color-fg);
  }
  .big-num .num-unit {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); letter-spacing: 0.08em;
  }

  .bk-dl {
    display: grid; grid-template-columns: auto 1fr;
    gap: 6px var(--sp-3); margin: 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .bk-dl dt { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .bk-dl dd { color: var(--color-fg); margin: 0; }
  .bk-dl b { color: var(--color-fg); font-weight: 400; }

  .sparkline {
    display: flex; align-items: flex-end; gap: 6px;
    height: 64px;
    padding-top: var(--sp-2);
  }
  .spark-bar {
    flex: 1;
    display: flex; flex-direction: column; align-items: center;
    gap: 4px;
    height: 100%;
    justify-content: flex-end;
  }
  .spark-fill {
    width: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 4px var(--accent-glow);
    min-height: 2px;
  }
  .spark-label {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
  }

  .workouts {
    display: flex; flex-direction: column;
    padding-bottom: var(--sp-8);
  }
  .workout {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
    align-items: baseline;
  }
  .workout-when {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .workout-name {
    font-family: var(--font-display); font-size: 18px;
    color: var(--color-fg);
    letter-spacing: -0.01em;
  }
  .workout-meta {
    margin-top: 4px;
    display: flex; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
  }
  .workout-meta .dot { color: var(--color-fg-ghost); }

  .empty {
    padding: var(--sp-8) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .h-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 980px) {
    .bento { grid-template-columns: repeat(6, 1fr); }
    .c-sleep { grid-column: span 6; }
    .c-steps { grid-column: span 6; }
    .c-vitals { grid-column: span 6; }
    .h-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
