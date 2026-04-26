import { Link, useMatch } from '@tanstack/react-router';
import { useMemo } from 'react';
import type {
  HealthIndex,
  HealthLatest,
  HealthLifetime,
  HealthMetric,
  HealthMetricPoint,
  HealthSnapshot,
  HealthWorkout,
} from '../server/health';

type Scope = { type: 'recent' } | { type: 'month'; month: string };
type LoaderData = {
  snap: HealthSnapshot | null;
  archive: HealthIndex | null;
  lifetime: HealthLifetime | null;
  latest: HealthLatest | null;
  scope: Scope;
};

// Both /health and /health/m/$month use this same component — read
// loader data via useMatch so we don't have to duplicate the page for
// the two routes.
function useHealthLoaderData(): LoaderData {
  const match = useMatch({ strict: false });
  return match.loaderData as LoaderData;
}

function fmtMonthLabel(m: string): string {
  // 'YYYY-MM' → 'April 2024'
  const [y, mm] = m.split('-');
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

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

/** Friendly duration formatter for a value in *minutes*. Collapses
 *  >= 60 min into 'Xh Ym' / 'Xh', and >= 24h into 'Xd Yh'. Used in the
 *  activity-mix breakdown where totals can range from a single session
 *  (~30 min) to lifetime aggregates (hundreds of hours). */
function fmtDuration(mins: number): string {
  const total = Math.round(mins);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

export default function HealthPage() {
  const data = useHealthLoaderData();
  const snap = data.snap;
  const scope = data.scope;
  const archive = data.archive;
  const lifetime = data.lifetime;
  const latest = data.latest;

  const metrics = snap?.metrics ?? [];

  const stepMetric = findMetric(metrics, ['step_count', 'steps']);
  const sleepMetric = findMetric(metrics, ['sleep_analysis', 'sleep']);
  const energyMetric = findMetric(metrics, ['active_energy', 'active_energy_burned']);
  const heartRestMetric = findMetric(metrics, ['resting_heart_rate']);
  const hrvMetric = findMetric(metrics, ['heart_rate_variability']);
  const exerciseMetric = findMetric(metrics, ['apple_exercise_time']);
  const standMetric = findMetric(metrics, ['apple_stand_hour', 'apple_stand_time']);
  const daylightMetric = findMetric(metrics, ['time_in_daylight']);
  const vo2Metric = findMetric(metrics, ['vo2_max']);
  const mindfulMetric = findMetric(metrics, ['mindful_minutes']);
  const flightsMetric = findMetric(metrics, ['flights_climbed']);
  const walkRunMetric = findMetric(metrics, ['walking_running_distance']);
  const cyclingMetric = findMetric(metrics, ['cycling_distance']);

  // Pull the latest non-null value from a metric — used for body
  // measurements which are sparse (e.g. weighed once a fortnight).
  function latestOf(m: typeof metrics[number] | null): { value: number; day: string } | null {
    if (!m) return null;
    const sorted = m.data
      .map((p) => ({ p, d: dateOf(p) }))
      .filter((x): x is { p: HealthMetricPoint; d: Date } => x.d != null)
      .sort((a, b) => b.d.getTime() - a.d.getTime());
    const latest = sorted.find((x) => num(x.p.qty) != null);
    if (!latest) return null;
    return { value: num(latest.p.qty)!, day: fmtDay(latest.d) };
  }
  function todayTotalOf(m: typeof metrics[number] | null): number | null {
    if (!m) return null;
    const t = m.data
      .filter((p) => {
        const d = dateOf(p);
        return d ? isToday(d) : false;
      })
      .reduce((sum, p) => sum + (num(p.qty) ?? 0), 0);
    return t > 0 ? t : null;
  }

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
    // Apple Watch's newer sleep-stage recordings set the legacy `asleep`
    // field to 0 and put the time in `core`/`deep`/`rem` instead, with a
    // `totalSleep` summary. Prefer totalSleep, then sum the stages, then
    // fall back to the legacy field for older nights.
    const stages = [num(p.core), num(p.deep), num(p.rem)].filter(
      (v): v is number => v != null,
    );
    const stageSum = stages.length > 0 ? stages.reduce((a, b) => a + b, 0) : null;
    const totalSleep = num(p.totalSleep);
    const legacyAsleep = num(p.asleep);
    const asleep =
      (totalSleep != null && totalSleep > 0 && totalSleep) ||
      (stageSum != null && stageSum > 0 && stageSum) ||
      legacyAsleep;
    return {
      asleep,
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

  // workouts grouped by name → quick activity-mix breakdown that
  // surfaces "I did 12 outdoor cycles + 4 walks this window" without
  // making you scan the list. Sort by total duration desc.
  const workoutsByType = useMemo(() => {
    const by = new Map<string, { count: number; totalMinutes: number }>();
    for (const w of snap?.workouts ?? []) {
      const name = (typeof w.name === 'string' ? w.name : '?').toLowerCase();
      // HAE encodes workout duration in seconds — convert to minutes
      // so the display unit matches the label.
      const durMin = (typeof w.duration === 'number' ? w.duration : 0) / 60;
      const e = by.get(name) ?? { count: 0, totalMinutes: 0 };
      e.count++;
      e.totalMinutes += durMin;
      by.set(name, e);
    }
    return [...by.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [snap?.workouts]);

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
            <span className="scope-tag">
              {scope.type === 'month' ? (
                <>
                  scope: <b className="t-accent">{fmtMonthLabel(scope.month)}</b>{' '}
                  <Link to="/health" className="t-faint">(clear)</Link>
                </>
              ) : (
                <>scope: <b>last {snap.months.length} months</b></>
              )}
            </span>
          </div>
        </header>

        {lifetime ? <LifetimeStrip lifetime={lifetime} /> : null}

        <section className="bento">
          <div className="panel c-sleep">
            <div className="panel-hd">
              <Link to="/health/sleep" className="ttl ttl-link">sleep →</Link>
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
              {(() => {
                const hrv = latestOf(hrvMetric);
                return hrv ? (
                  <>
                    <dt>hrv</dt>
                    <dd><b>{Math.round(hrv.value)} ms</b></dd>
                  </>
                ) : null;
              })()}
              {(() => {
                const vo2 = latestOf(vo2Metric);
                return vo2 ? (
                  <>
                    <dt>vo₂ max</dt>
                    <dd><b>{vo2.value.toFixed(1)}</b></dd>
                  </>
                ) : null;
              })()}
              <dt>active</dt>
              <dd>{todayEnergy != null ? <b>{todayEnergy} kcal</b> : '—'}</dd>
            </dl>
          </div>
        </section>

        {/* second bento row — body, activity, exposure */}
        <section className="bento">
          {(() => {
            // Body measurements come from the persistent health:latest
            // bucket on the index route; per-month routes set
            // latest=null and we fall back to whatever's in the month
            // (typically nothing — body data is sparse).
            const w = latest?.weightKg ?? null;
            const f = latest?.bodyFat ?? null;
            const b = latest?.bmi ?? null;
            const h = latest?.heightM ?? null;
            if (!w && !f && !b && !h) return null;
            const fmtAsOf = (iso: string): string => {
              const d = new Date(iso);
              return Number.isFinite(d.getTime()) ? fmtDay(d) : iso;
            };
            return (
              <div className="panel c-body">
                <div className="panel-hd">
                  <span className="ttl">body</span>
                  <span className="src-tag">latest</span>
                </div>
                <dl className="bk-dl">
                  {w ? (
                    <>
                      <dt>weight</dt>
                      <dd><b>{w.value.toFixed(1)} kg</b><span className="t-faint"> · {fmtAsOf(w.date)}</span></dd>
                    </>
                  ) : null}
                  {f ? (
                    <>
                      <dt>body fat</dt>
                      <dd><b>{(f.value * 100).toFixed(1)}%</b><span className="t-faint"> · {fmtAsOf(f.date)}</span></dd>
                    </>
                  ) : null}
                  {b ? (
                    <>
                      <dt>bmi</dt>
                      <dd><b>{b.value.toFixed(1)}</b></dd>
                    </>
                  ) : null}
                  {h ? (
                    <>
                      <dt>height</dt>
                      <dd><b>{h.value.toFixed(2)} m</b></dd>
                    </>
                  ) : null}
                </dl>
              </div>
            );
          })()}

          <div className="panel c-activity">
            <div className="panel-hd">
              <span className="ttl">activity</span>
              <span className="src-tag">today</span>
            </div>
            <dl className="bk-dl">
              {(() => {
                const ex = todayTotalOf(exerciseMetric);
                return (
                  <>
                    <dt>exercise</dt>
                    <dd>{ex != null ? <b>{Math.round(ex)} min</b> : '—'}</dd>
                  </>
                );
              })()}
              {(() => {
                const stand = todayTotalOf(standMetric);
                return (
                  <>
                    <dt>stand</dt>
                    <dd>{stand != null ? <b>{Math.round(stand)} hrs</b> : '—'}</dd>
                  </>
                );
              })()}
              {(() => {
                const flights = todayTotalOf(flightsMetric);
                return flights != null ? (
                  <>
                    <dt>flights</dt>
                    <dd><b>{Math.round(flights)}</b></dd>
                  </>
                ) : null;
              })()}
              {(() => {
                const mind = todayTotalOf(mindfulMetric);
                return mind != null ? (
                  <>
                    <dt>mindful</dt>
                    <dd><b>{Math.round(mind)} min</b></dd>
                  </>
                ) : null;
              })()}
            </dl>
          </div>

          <div className="panel c-exposure">
            <div className="panel-hd">
              <span className="ttl">distance</span>
              <span className="src-tag">today</span>
            </div>
            <dl className="bk-dl">
              {(() => {
                const wr = todayTotalOf(walkRunMetric);
                return (
                  <>
                    <dt>walk / run</dt>
                    <dd>{wr != null ? <b>{wr.toFixed(2)} km</b> : '—'}</dd>
                  </>
                );
              })()}
              {(() => {
                const c = todayTotalOf(cyclingMetric);
                return c != null ? (
                  <>
                    <dt>cycle</dt>
                    <dd><b>{c.toFixed(2)} km</b></dd>
                  </>
                ) : null;
              })()}
              {(() => {
                const dl = todayTotalOf(daylightMetric);
                return dl != null ? (
                  <>
                    <dt>daylight</dt>
                    <dd><b>{Math.round(dl)} min</b></dd>
                  </>
                ) : null;
              })()}
            </dl>
          </div>
        </section>

        {/* workout breakdown by type — quick activity-mix view */}
        {workoutsByType.length > 0 ? (
          <>
            <div className="section-hd">
              <h2>
                <span className="num">02 //</span>activity mix.
              </h2>
              <span className="src">{workoutsByType.length} workout types in window</span>
            </div>
            <section className="workout-types">
              {workoutsByType.map((t) => (
                <div key={t.name} className="wt">
                  <div className="wt-name">{t.name}</div>
                  <div className="wt-stats">
                    <span><b>{t.count}</b> sessions</span>
                    <span className="dot">·</span>
                    <span><b>{fmtDuration(t.totalMinutes)}</b> total</span>
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : null}

        <div className="section-hd">
          <h2>
            <span className="num">03 //</span>workouts.
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

        {archive && archive.months.length > 0 ? (
          <ArchiveSection months={archive.months} currentScope={scope} />
        ) : null}

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

function LifetimeStrip({ lifetime }: { lifetime: HealthLifetime }) {
  const t = lifetime.totals;
  // friendly aggregate formatters
  const fmtH = (mins: number) => {
    const h = Math.round(mins / 60);
    return h >= 1000 ? `${(h / 1000).toFixed(1)}k h` : `${h.toLocaleString()} h`;
  };
  const fmtSteps = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };
  const fmtKm = (km: number) => {
    if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
    return `${Math.round(km).toLocaleString()} km`;
  };
  return (
    <section className="lifetime-strip">
      <div className="ls-hd">
        <span className="ls-title">all-time</span>
        <span className="ls-range">
          {lifetime.earliest} → {lifetime.latest} · {lifetime.monthsCovered} months
        </span>
      </div>
      <div className="ls-grid">
        <div className="ls-cell">
          <div className="ls-label">workouts</div>
          <div className="ls-value">{t.workouts.toLocaleString()}</div>
          <div className="ls-sub">{fmtH(t.workoutMinutes)} active</div>
        </div>
        <div className="ls-cell">
          <div className="ls-label">distance</div>
          <div className="ls-value">{fmtKm(t.workoutKm)}</div>
          <div className="ls-sub">across all activities</div>
        </div>
        <div className="ls-cell">
          <div className="ls-label">workout kcal</div>
          <div className="ls-value">{Math.round(t.workoutKcal).toLocaleString()}</div>
          <div className="ls-sub">burned</div>
        </div>
        <div className="ls-cell">
          <div className="ls-label">sleep tracked</div>
          <div className="ls-value">{Math.round(t.sleepHours).toLocaleString()} h</div>
          <div className="ls-sub">{t.sleepNights.toLocaleString()} nights</div>
        </div>
        <div className="ls-cell">
          <div className="ls-label">steps</div>
          <div className="ls-value">{fmtSteps(t.steps)}</div>
          <div className="ls-sub">total recorded</div>
        </div>
        <div className="ls-cell">
          <div className="ls-label">flights</div>
          <div className="ls-value">{Math.round(t.flightsClimbed).toLocaleString()}</div>
          <div className="ls-sub">climbed</div>
        </div>
      </div>
    </section>
  );
}

function ArchiveSection({
  months,
  currentScope,
}: {
  months: string[];
  currentScope: Scope;
}) {
  // Group months by year so the archive reads as a year-by-year
  // calendar rather than 89 sibling chips. Each year row shows the
  // 12 months as buttons; months without data show as faint
  // placeholders so visitors can see the coverage gaps.
  const byYear = new Map<string, Set<string>>();
  for (const m of months) {
    const [y, mm] = m.split('-');
    let set = byYear.get(y);
    if (!set) {
      set = new Set<string>();
      byYear.set(y, set);
    }
    set.add(mm);
  }
  const years = [...byYear.keys()].sort().reverse();
  const monthLabels = ['j', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];

  const activeMonth = currentScope.type === 'month' ? currentScope.month : null;

  return (
    <>
      <div className="section-hd">
        <h2>
          <span className="num">04 //</span>archive.
        </h2>
        <span className="src">
          {months.length} months · {years[years.length - 1]} → {years[0]}
        </span>
      </div>
      <section className="archive">
        {years.map((year) => {
          const present = byYear.get(year) ?? new Set<string>();
          return (
            <div key={year} className="archive-row">
              <span className="archive-year">{year}</span>
              <div className="archive-months">
                {monthLabels.map((label, i) => {
                  const mm = String(i + 1).padStart(2, '0');
                  const month = `${year}-${mm}`;
                  const has = present.has(mm);
                  const isActive = activeMonth === month;
                  if (!has) {
                    return (
                      <span key={month} className="archive-cell archive-empty" title={`no data for ${month}`}>
                        {label}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={month}
                      to="/health/m/$month"
                      params={{ month }}
                      className={'archive-cell archive-has' + (isActive ? ' archive-active' : '')}
                      title={`view ${fmtMonthLabel(month)}`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function WorkoutRow({ w }: { w: HealthWorkout }) {
  const start = w.start ? new Date(w.start as string) : null;
  const km = w.distance?.qty ?? null;
  const kcal = w.activeEnergyBurned?.qty ?? null;
  const id = typeof (w as { id?: unknown }).id === 'string' ? (w as { id: string }).id : null;
  // workouts now ship a per-minute heartRateData array — render a tiny
  // sparkline of the avg HR samples so the row carries a visual cue
  // for intensity in addition to the duration / kcal numbers.
  const hrSamples = Array.isArray(
    (w as Record<string, unknown>).heartRateData,
  )
    ? ((w as { heartRateData: Array<Record<string, unknown>> }).heartRateData
        .map((p) => Number((p as { Avg?: number }).Avg ?? (p as { avg?: number }).avg ?? 0))
        .filter((n) => Number.isFinite(n) && n > 0))
    : [];
  const avgHr =
    typeof (w as Record<string, unknown>).avgHeartRate === 'object'
      ? Number(
          ((w as { avgHeartRate?: { qty?: number } }).avgHeartRate?.qty ?? 0),
        )
      : 0;
  const maxHr =
    typeof (w as Record<string, unknown>).maxHeartRate === 'object'
      ? Number(
          ((w as { maxHeartRate?: { qty?: number } }).maxHeartRate?.qty ?? 0),
        )
      : 0;
  const inner = (
    <>
      <div className="workout-when">
        {start ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
      </div>
      <div className="workout-body">
        <div className="workout-name">{(w.name ?? 'workout').toLowerCase()}</div>
        <div className="workout-meta t-faint">
          {w.duration ? <span>{fmtDuration(w.duration / 60)}</span> : null}
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
          {avgHr > 0 ? (
            <>
              <span className="dot">·</span>
              <span>
                {Math.round(avgHr)} avg
                {maxHr > 0 ? <span className="t-faint"> / {Math.round(maxHr)} max</span> : null}
                {' '}bpm
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="workout-spark">
        {hrSamples.length > 1 ? <HrSparkline samples={hrSamples} /> : null}
      </div>
    </>
  );
  if (id) {
    return (
      <Link
        to="/health/workouts/$id"
        params={{ id }}
        className="workout workout-link"
      >
        {inner}
      </Link>
    );
  }
  return <article className="workout">{inner}</article>;
}

/** Inline SVG line of heart-rate samples normalised to its own min/max
 *  so each workout's curve fills the sparkline regardless of absolute
 *  bpm range. ~120px wide, fixed height. */
function HrSparkline({ samples }: { samples: number[] }) {
  const W = 120;
  const H = 28;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const span = max - min || 1;
  const stepX = W / (samples.length - 1);
  const points = samples
    .map((v, i) => {
      const x = i * stepX;
      const y = H - ((v - min) / span) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="hr-spark" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
  .panel-hd .ttl-link {
    color: var(--color-accent);
    text-decoration: none;
  }
  .panel-hd .ttl-link:hover { text-decoration: underline; }
  .panel-hd .src-tag { color: var(--color-fg-faint); }

  /* lifetime strip — all-time aggregates across every month bucket */
  .lifetime-strip {
    margin: var(--sp-5) 0 0;
    padding: var(--sp-4) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .ls-hd {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: var(--sp-3);
    font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--color-fg-faint);
  }
  .ls-title { color: var(--color-accent); }
  .ls-range { color: var(--color-fg-faint); }
  .ls-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--sp-3);
  }
  .ls-cell {
    display: flex; flex-direction: column; gap: 2px;
    min-width: 0;
    padding-right: var(--sp-3);
    border-right: 1px dashed var(--color-border);
  }
  .ls-cell:last-child { border-right: none; }
  .ls-value, .ls-label, .ls-sub {
    overflow-wrap: anywhere;
  }
  @media (max-width: 720px) {
    .ls-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ls-cell:nth-child(3n) { border-right: none; }
    .ls-value { font-size: 22px; }
  }
  @media (max-width: 420px) {
    .ls-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ls-cell:nth-child(3n) { border-right: 1px dashed var(--color-border); }
    .ls-cell:nth-child(2n) { border-right: none; }
  }
  .ls-label {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .ls-value {
    font-family: var(--font-display);
    font-size: 28px; line-height: 1;
    color: var(--color-fg);
    letter-spacing: -0.02em;
    margin-top: 4px;
  }
  .ls-sub {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .c-sleep { grid-column: span 5; }
  .c-steps { grid-column: span 4; }
  .c-vitals { grid-column: span 3; }
  .c-body { grid-column: span 4; }
  .c-activity { grid-column: span 4; }
  .c-exposure { grid-column: span 4; }

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

  /* workout types breakdown */
  .workout-types {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--sp-3);
    padding: 0 0 var(--sp-5);
  }
  .wt {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: 4px;
  }
  .wt-name {
    font-family: var(--font-display); font-size: 16px;
    color: var(--color-fg);
    text-transform: lowercase;
    letter-spacing: -0.01em;
  }
  .wt-stats {
    display: flex; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }
  .wt-stats b { color: var(--color-accent); font-weight: 400; }
  .wt-stats .dot { color: var(--color-fg-ghost); }

  .workouts {
    display: flex; flex-direction: column;
    padding-bottom: var(--sp-8);
  }
  .workout {
    display: grid;
    grid-template-columns: 80px 1fr 130px;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
    align-items: center;
  }
  .workout-spark {
    display: flex; align-items: center; justify-content: flex-end;
  }
  .hr-spark { display: block; }
  .workout-link {
    text-decoration: none; color: inherit;
  }
  .workout-link:hover { text-decoration: none; background: var(--color-bg-panel); }
  .workout-link:hover .workout-name { color: var(--color-accent); }

  /* scope tag */
  .scope-tag {
    color: var(--color-fg-faint);
    text-transform: lowercase; letter-spacing: 0.06em;
  }
  .scope-tag b.t-accent { color: var(--color-accent); font-weight: 400; }
  .scope-tag b { color: var(--color-fg); font-weight: 400; }
  .scope-tag a { color: var(--color-fg-faint); text-decoration: underline; }
  .scope-tag a:hover { color: var(--color-accent); }

  /* archive — year x month grid for browsing past data */
  .archive {
    display: flex; flex-direction: column;
    gap: 6px;
    padding-bottom: var(--sp-8);
  }
  .archive-row {
    display: flex; align-items: center; gap: var(--sp-3);
    padding: 4px 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .archive-year {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    min-width: 48px;
  }
  .archive-months { display: flex; gap: 2px; flex: 1; }
  .archive-cell {
    flex: 1;
    text-align: center;
    padding: 6px 0;
    font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em;
    text-decoration: none;
    border: 1px solid transparent;
  }
  .archive-empty {
    color: var(--color-fg-ghost);
    background: transparent;
  }
  .archive-has {
    color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
    border-color: var(--color-accent-dim);
  }
  .archive-has:hover {
    background: color-mix(in oklch, var(--color-accent) 18%, transparent);
    text-decoration: none;
  }
  .archive-active {
    color: var(--color-bg);
    background: var(--color-accent);
    border-color: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
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
    .c-sleep, .c-steps, .c-vitals,
    .c-body, .c-activity, .c-exposure {
      grid-column: span 6;
    }
    .workout { grid-template-columns: 70px 1fr; }
    .workout-spark { display: none; }
    .h-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
