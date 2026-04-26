import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

// Apple Health → /health page, fed by the Health Auto Export iOS app
// (https://www.healthexportapp.com/) which can be configured to POST a
// JSON snapshot of selected metrics + workouts on a schedule. We bucket
// each push by month so historical data accumulates over time rather
// than getting overwritten — keys look like:
//
//   health:m:2026-04                 (monthly bucket: metrics + workouts)
//   health:index                     ({ months: ['2026-04', ...], lastUpdated })
//
// On read, getHealth() unions the last N months so the page can render
// rolling-window charts that span actual history rather than a single
// snapshot.

/** A single timestamped data point within a metric's `data` array. */
export type HealthMetricPoint = Record<string, string | number | undefined> & {
  date?: string;
};

export type HealthMetric = {
  name: string;
  units?: string;
  data: HealthMetricPoint[];
};

export type HealthWorkout = {
  name?: string;
  start?: string;
  end?: string;
  duration?: number;
  distance?: { qty?: number; units?: string };
  activeEnergyBurned?: { qty?: number; units?: string };
  [key: string]: unknown;
};

export type HealthSnapshot = {
  /** server-side timestamp of the most recent successful push (ms) */
  ts: number;
  /** months covered by this snapshot (sorted newest-first), so the
   *  page can show "history goes back to march 2026" + an archive list
   *  without a separate index call */
  months: string[];
  metrics: HealthMetric[];
  workouts: HealthWorkout[];
};

export type HealthIndex = {
  months: string[];
  lastUpdated: number;
};

/** Number of most-recent months the page reads at once. ~6 months of
 *  daily metrics weighs ~100-300KB so this is well under any worker
 *  response budget. */
export const HEALTH_DEFAULT_WINDOW = 6;

export const HEALTH_INDEX_KEY = 'health:index';
export const healthMonthKey = (m: string): string => `health:m:${m}`;

/** ISO 'YYYY-MM' month bucket for a HAE-formatted date string. */
export function monthOf(date: string | undefined): string | null {
  if (!date) return null;
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 7);
}

/** Merge per-month bucket payloads (newest first) into the unified
 *  HealthSnapshot the page renders. Each metric's data array is
 *  concatenated across months; workouts collapse into one flat list.
 *  Deduplication on `(date, source)` for metric points and `(start)`
 *  for workouts catches overlapping push windows. */
export function mergeMonthBuckets(
  buckets: Array<{ ts: number; metrics: HealthMetric[]; workouts: HealthWorkout[] } | null>,
  months: string[],
): HealthSnapshot {
  const byMetric = new Map<string, { units?: string; pts: Map<string, HealthMetricPoint> }>();
  const workouts = new Map<string, HealthWorkout>();
  let latestTs = 0;

  for (const b of buckets) {
    if (!b) continue;
    if (b.ts > latestTs) latestTs = b.ts;

    for (const m of b.metrics ?? []) {
      let entry = byMetric.get(m.name);
      if (!entry) {
        entry = { units: m.units, pts: new Map<string, HealthMetricPoint>() };
        byMetric.set(m.name, entry);
      } else if (!entry.units && m.units) {
        entry.units = m.units;
      }
      for (const p of m.data ?? []) {
        const key = `${p.date ?? ''}|${(p.source as string | undefined) ?? ''}`;
        // last-write-wins on dup keys; HAE re-pushes are ~stable so
        // it doesn't really matter which copy survives.
        entry.pts.set(key, p);
      }
    }

    for (const w of b.workouts ?? []) {
      const key = `${(w.start as string | undefined) ?? ''}|${w.name ?? ''}`;
      workouts.set(key, w);
    }
  }

  const metrics: HealthMetric[] = [];
  for (const [name, { units, pts }] of byMetric) {
    metrics.push({ name, units, data: [...pts.values()] });
  }

  return {
    ts: latestTs,
    months: [...months].sort().reverse(),
    metrics,
    workouts: [...workouts.values()],
  };
}

export const getHealth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HealthSnapshot | null> => {
    const kv = env.HOMELAB;
    if (!kv) return null;
    const idx = await kv.get<HealthIndex>(HEALTH_INDEX_KEY, { type: 'json' });
    const months = (idx?.months ?? []).sort().reverse();
    if (months.length === 0) return null;
    const window = months.slice(0, HEALTH_DEFAULT_WINDOW);
    const buckets = await Promise.all(
      window.map((m) =>
        kv.get<{ ts: number; metrics: HealthMetric[]; workouts: HealthWorkout[] }>(
          healthMonthKey(m),
          { type: 'json' },
        ),
      ),
    );
    return mergeMonthBuckets(buckets, months);
  },
);

/** Return the snapshot for a specific YYYY-MM bucket, or null if that
 *  month has no data. The `months` field on the returned snapshot is
 *  just the single requested month so the page can render its
 *  "viewing april 2024" banner consistently. */
export const getHealthMonth = createServerFn({ method: 'GET' })
  .inputValidator((input: { month: string }) => input)
  .handler(async ({ data }): Promise<HealthSnapshot | null> => {
    const kv = env.HOMELAB;
    if (!kv) return null;
    if (!/^\d{4}-\d{2}$/.test(data.month)) return null;
    const bucket = await kv.get<{
      ts: number;
      metrics: HealthMetric[];
      workouts: HealthWorkout[];
    }>(healthMonthKey(data.month), { type: 'json' });
    if (!bucket) return null;
    return mergeMonthBuckets([bucket], [data.month]);
  });

/** Just the index — list of every month with data. /health uses it
 *  for the archive section without needing to read all the buckets. */
export const getHealthArchive = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HealthIndex | null> => {
    const kv = env.HOMELAB;
    if (!kv) return null;
    return await kv.get<HealthIndex>(HEALTH_INDEX_KEY, { type: 'json' });
  },
);

export type HealthLifetime = {
  monthsCovered: number;
  earliest: string | null;
  latest: string | null;
  totals: {
    workouts: number;
    workoutMinutes: number;
    workoutKm: number;
    workoutKcal: number;
    sleepHours: number;
    sleepNights: number;
    steps: number;
    flightsClimbed: number;
    mindfulMinutes: number;
    daylightMinutes: number;
  };
  workoutsByType: Array<{ name: string; count: number; minutes: number }>;
};

/** Cross-month aggregator — reads every month bucket, sums per-metric
 *  totals, and returns headline numbers for the page's stats strip.
 *  Heavy on first call (~N KV reads) but cached TTL.medium so it's
 *  rebuilt at most twice an hour. */
export const getHealthLifetime = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HealthLifetime | null> => {
    const kv = env.HOMELAB;
    if (!kv) return null;
    const idx = await kv.get<HealthIndex>(HEALTH_INDEX_KEY, { type: 'json' });
    const months = (idx?.months ?? []).sort();
    if (months.length === 0) return null;

    const buckets = await Promise.all(
      months.map((m) =>
        kv.get<{ ts: number; metrics: HealthMetric[]; workouts: HealthWorkout[] }>(
          healthMonthKey(m),
          { type: 'json' },
        ),
      ),
    );

    let workouts = 0;
    let workoutMinutes = 0;
    let workoutKm = 0;
    let workoutKcal = 0;
    let sleepHours = 0;
    let sleepNights = 0;
    let steps = 0;
    let flightsClimbed = 0;
    let mindfulMinutes = 0;
    let daylightMinutes = 0;
    const byType = new Map<string, { count: number; minutes: number }>();

    for (const b of buckets) {
      if (!b) continue;
      for (const w of b.workouts ?? []) {
        workouts++;
        const dur = typeof w.duration === 'number' ? w.duration : 0;
        workoutMinutes += dur;
        const km = (w.distance as { qty?: number } | undefined)?.qty;
        if (typeof km === 'number') workoutKm += km;
        const kcal = (w.activeEnergyBurned as { qty?: number } | undefined)?.qty;
        if (typeof kcal === 'number') workoutKcal += kcal;
        const name = (typeof w.name === 'string' ? w.name : 'workout').toLowerCase();
        const e = byType.get(name) ?? { count: 0, minutes: 0 };
        e.count++;
        e.minutes += dur;
        byType.set(name, e);
      }
      for (const m of b.metrics ?? []) {
        const name = m.name.toLowerCase();
        for (const p of m.data ?? []) {
          const q = typeof p.qty === 'number' ? p.qty : Number(p.qty);
          if (name === 'sleep_analysis' || name === 'sleep') {
            // newer Apple Watch recordings put 0 in legacy `asleep` and
            // split the time across `core`/`deep`/`rem` — prefer
            // totalSleep, then stage sum, then legacy field.
            const total = typeof p.totalSleep === 'number' ? p.totalSleep : Number(p.totalSleep);
            const core = typeof p.core === 'number' ? p.core : Number(p.core);
            const deep = typeof p.deep === 'number' ? p.deep : Number(p.deep);
            const rem = typeof p.rem === 'number' ? p.rem : Number(p.rem);
            const legacy = typeof p.asleep === 'number' ? p.asleep : Number(p.asleep);
            const stageSum = [core, deep, rem]
              .filter((v) => Number.isFinite(v) && v > 0)
              .reduce((a, b) => a + b, 0);
            const a =
              (Number.isFinite(total) && total > 0 && total) ||
              (stageSum > 0 && stageSum) ||
              legacy;
            if (Number.isFinite(a) && a > 0) {
              sleepHours += a;
              sleepNights++;
            }
          } else if (name === 'step_count' || name === 'steps') {
            if (Number.isFinite(q)) steps += q;
          } else if (name === 'flights_climbed') {
            if (Number.isFinite(q)) flightsClimbed += q;
          } else if (name === 'mindful_minutes') {
            if (Number.isFinite(q)) mindfulMinutes += q;
          } else if (name === 'time_in_daylight') {
            if (Number.isFinite(q)) daylightMinutes += q;
          }
        }
      }
    }

    const workoutsByType = [...byType.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      monthsCovered: months.length,
      earliest: months[0] ?? null,
      latest: months[months.length - 1] ?? null,
      totals: {
        workouts,
        workoutMinutes,
        workoutKm,
        workoutKcal,
        sleepHours,
        sleepNights,
        steps,
        flightsClimbed,
        mindfulMinutes,
        daylightMinutes,
      },
      workoutsByType,
    };
  },
);
