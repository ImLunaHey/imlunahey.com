#!/usr/bin/env node
/**
 * One-shot: rebuild the `health:latest` KV bucket by scanning every
 * month bucket and recording the newest reading of each sparse metric
 * (weight, BMI, body-fat, height, lean mass, VO2 max).
 *
 *   pnpm tsx scripts/health-rebuild-latest.ts
 *
 * After this runs once, the ingest endpoint maintains health:latest
 * incrementally on every push, so this script doesn't need to run
 * again — it exists purely to populate the bucket from data that was
 * pushed before the latest-tracking logic was added.
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

async function main() {
  const idx = wranglerKvGet('health:index') as { months?: string[] } | null;
  const months = (idx?.months ?? []).sort();
  if (months.length === 0) {
    console.error('no months in health:index');
    process.exit(1);
  }
  console.log(`scanning ${months.length} months for sparse-metric latest readings...`);

  const latest: HealthLatest = {
    weightKg: null,
    bmi: null,
    bodyFat: null,
    heightM: null,
    leanMassKg: null,
    vo2Max: null,
    lastUpdated: 0,
  };
  let anyChanged = false;

  for (const m of months) {
    const bucket = wranglerKvGet(`health:m:${m}`) as
      | { metrics?: Array<{ name?: string; data?: Array<Record<string, unknown>> }> }
      | null;
    if (!bucket) continue;
    let monthChanged = false;
    for (const metric of bucket.metrics ?? []) {
      if (!metric.name) continue;
      const field = FIELD_BY_METRIC[metric.name.toLowerCase()];
      if (!field) continue;
      for (const p of metric.data ?? []) {
        const q = typeof p.qty === 'number' ? p.qty : Number(p.qty);
        const date = typeof p.date === 'string' ? p.date : null;
        if (!date) continue;
        if (update(latest, field, q, date)) monthChanged = true;
      }
    }
    if (monthChanged) {
      anyChanged = true;
      console.log(
        `  ${m}: weight=${latest.weightKg?.value ?? '—'} bmi=${latest.bmi?.value ?? '—'} bf=${latest.bodyFat?.value ?? '—'} height=${latest.heightM?.value ?? '—'} vo2=${latest.vo2Max?.value ?? '—'}`,
      );
    }
  }

  if (!anyChanged) {
    console.log('no sparse-metric points found in any bucket — nothing to write');
    return;
  }

  latest.lastUpdated = Date.now();
  console.log('\nfinal health:latest:');
  console.log(JSON.stringify(latest, null, 2));
  console.log('\nwriting to KV...');
  wranglerKvPut('health:latest', latest);
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
