#!/usr/bin/env node
/**
 * One-shot: rebuild the derived `health:latest` and `health:lifetime`
 * KV buckets from scratch by walking every month bucket.
 *
 *   pnpm tsx scripts/health-rebuild-latest.ts
 *
 *  - health:latest    newest reading of each sparse metric
 *                     (weight, BMI, body-fat, height, lean mass, VO2 max)
 *  - health:lifetime  per-month aggregates (workouts/sleep/steps/etc.)
 *                     summed into lifetime totals on read
 *
 * After this runs once, the ingest endpoint maintains both buckets
 * incrementally on every push, so this script doesn't need to run
 * again — it exists purely to populate the buckets from data that was
 * pushed before the derived-bucket logic was added.
 *
 * Uses the wrangler CLI to read/write KV directly so it doesn't need
 * its own auth path. Logic is inlined rather than imported from
 * src/server/health.ts because that module pulls in
 * cloudflare:workers which isn't resolvable under plain node.
 */

import { execFileSync } from 'node:child_process';

const NAMESPACE_ID = '87f8cd0410224ac99c0ca2a16a1a3fd6';

type LatestVal = { value: number; date: string } | null;
type HealthLatest = {
  weightKg: LatestVal;
  bmi: LatestVal;
  bodyFat: LatestVal;
  heightM: LatestVal;
  leanMassKg: LatestVal;
  vo2Max: LatestVal;
  lastUpdated: number;
};

const FIELD_BY_METRIC: Record<string, keyof Omit<HealthLatest, 'lastUpdated'>> = {
  weight_body_mass: 'weightKg',
  weight: 'weightKg',
  body_mass_index: 'bmi',
  bmi: 'bmi',
  body_fat_percentage: 'bodyFat',
  height: 'heightM',
  lean_body_mass: 'leanMassKg',
  vo2_max: 'vo2Max',
};

function wranglerKvGet(key: string): unknown {
  try {
    const out = execFileSync(
      'npx',
      ['wrangler', 'kv', 'key', 'get', '--namespace-id', NAMESPACE_ID, '--remote', key],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
    return JSON.parse(out);
  } catch (err) {
    console.error(`failed to get ${key}:`, (err as Error).message);
    return null;
  }
}

function wranglerKvPut(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  execFileSync(
    'npx',
    ['wrangler', 'kv', 'key', 'put', '--namespace-id', NAMESPACE_ID, '--remote', key, json],
    { stdio: 'inherit', maxBuffer: 16 * 1024 * 1024 },
  );
}

function update(
  latest: HealthLatest,
  field: keyof Omit<HealthLatest, 'lastUpdated'>,
  value: number,
  date: string,
): boolean {
  if (!Number.isFinite(value)) return false;
  const cur = latest[field];
  if (!cur || Date.parse(date) > Date.parse(cur.date)) {
    latest[field] = { value, date };
    return true;
  }
  return false;
}

type Workout = {
  name?: string;
  duration?: number;
  distance?: { qty?: number };
  activeEnergyBurned?: { qty?: number };
};

type MetricPoint = Record<string, unknown> & { qty?: unknown; date?: unknown };

type Bucket = {
  metrics?: Array<{ name?: string; data?: MetricPoint[] }>;
  workouts?: Workout[];
};

type MonthAggregate = {
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
  byType: Record<string, { count: number; minutes: number }>;
};

function aggregateMonth(bucket: Bucket): MonthAggregate {
  const a: MonthAggregate = {
    workouts: 0,
    workoutMinutes: 0,
    workoutKm: 0,
    workoutKcal: 0,
    sleepHours: 0,
    sleepNights: 0,
    steps: 0,
    flightsClimbed: 0,
    mindfulMinutes: 0,
    daylightMinutes: 0,
    byType: {},
  };
  for (const w of bucket.workouts ?? []) {
    a.workouts++;
    const durMin = (typeof w.duration === 'number' ? w.duration : 0) / 60;
    a.workoutMinutes += durMin;
    if (typeof w.distance?.qty === 'number') a.workoutKm += w.distance.qty;
    if (typeof w.activeEnergyBurned?.qty === 'number') a.workoutKcal += w.activeEnergyBurned.qty;
    const name = (typeof w.name === 'string' ? w.name : 'workout').toLowerCase();
    const e = a.byType[name] ?? { count: 0, minutes: 0 };
    e.count++;
    e.minutes += durMin;
    a.byType[name] = e;
  }
  for (const m of bucket.metrics ?? []) {
    if (!m.name) continue;
    const name = m.name.toLowerCase();
    for (const p of m.data ?? []) {
      const q = typeof p.qty === 'number' ? p.qty : Number(p.qty);
      if (name === 'sleep_analysis' || name === 'sleep') {
        const total = typeof p.totalSleep === 'number' ? p.totalSleep : Number(p.totalSleep);
        const core = typeof p.core === 'number' ? p.core : Number(p.core);
        const deep = typeof p.deep === 'number' ? p.deep : Number(p.deep);
        const rem = typeof p.rem === 'number' ? p.rem : Number(p.rem);
        const legacy = typeof p.asleep === 'number' ? p.asleep : Number(p.asleep);
        const stageSum = [core, deep, rem]
          .filter((v) => Number.isFinite(v) && v > 0)
          .reduce((s, v) => s + v, 0);
        const v =
          (Number.isFinite(total) && total > 0 && total) ||
          (stageSum > 0 && stageSum) ||
          legacy;
        if (Number.isFinite(v) && v > 0) {
          a.sleepHours += v;
          a.sleepNights++;
        }
      } else if (name === 'step_count' || name === 'steps') {
        if (Number.isFinite(q)) a.steps += q;
      } else if (name === 'flights_climbed') {
        if (Number.isFinite(q)) a.flightsClimbed += q;
      } else if (name === 'mindful_minutes') {
        if (Number.isFinite(q)) a.mindfulMinutes += q;
      } else if (name === 'time_in_daylight') {
        if (Number.isFinite(q)) a.daylightMinutes += q;
      }
    }
  }
  return a;
}

async function main() {
  const idx = wranglerKvGet('health:index') as { months?: string[] } | null;
  const months = (idx?.months ?? []).sort();
  if (months.length === 0) {
    console.error('no months in health:index');
    process.exit(1);
  }
  console.log(`scanning ${months.length} months to rebuild health:latest + health:lifetime...`);

  const latest: HealthLatest = {
    weightKg: null,
    bmi: null,
    bodyFat: null,
    heightM: null,
    leanMassKg: null,
    vo2Max: null,
    lastUpdated: 0,
  };
  const perMonth: Record<string, MonthAggregate> = {};
  let anyLatestChanged = false;

  for (const m of months) {
    const bucket = wranglerKvGet(`health:m:${m}`) as Bucket | null;
    if (!bucket) continue;
    perMonth[m] = aggregateMonth(bucket);
    let monthLatestChanged = false;
    for (const metric of bucket.metrics ?? []) {
      if (!metric.name) continue;
      const field = FIELD_BY_METRIC[metric.name.toLowerCase()];
      if (!field) continue;
      for (const p of metric.data ?? []) {
        const q = typeof p.qty === 'number' ? p.qty : Number(p.qty);
        const date = typeof p.date === 'string' ? p.date : null;
        if (!date) continue;
        if (update(latest, field, q, date)) monthLatestChanged = true;
      }
    }
    if (monthLatestChanged) anyLatestChanged = true;
    const ag = perMonth[m];
    console.log(
      `  ${m}: workouts=${ag.workouts} sleep_h=${ag.sleepHours.toFixed(1)} steps=${ag.steps}`,
    );
  }

  if (anyLatestChanged) {
    latest.lastUpdated = Date.now();
    console.log('\nwriting health:latest...');
    wranglerKvPut('health:latest', latest);
  } else {
    console.log('\nno sparse-metric data — skipping health:latest');
  }

  const lifetime = { perMonth, lastUpdated: Date.now() };
  console.log('writing health:lifetime...');
  wranglerKvPut('health:lifetime', lifetime);
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
