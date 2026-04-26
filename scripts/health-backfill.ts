#!/usr/bin/env node
/**
 * Backfill /api/health from a single Health Auto Export JSON file by
 * splitting it into per-month chunks and POSTing each one sequentially.
 *
 *   pnpm health:backfill <path-to-export.json>
 *
 * Why: a multi-year HAE export can easily exceed the worker's 30s CPU
 * budget when parsed in a single request, returning a Cloudflare 503.
 * Splitting at the file level into ~1MB month-sized chunks keeps each
 * push well within budget. The server's per-month bucket layout means
 * each chunk merges cleanly into its own bucket — order doesn't
 * matter, retries are idempotent.
 *
 * Reads HEALTH_TOKEN from .env.local (loaded by `tsx --env-file`).
 * Override the target URL with HEALTH_INGEST_URL for testing against
 * a local dev server.
 */

import { readFileSync } from 'node:fs';

const FILE = process.argv[2];
if (!FILE) {
  console.error('usage: pnpm health:backfill <path-to-export.json>');
  process.exit(1);
}

const TOKEN = process.env.HEALTH_TOKEN;
if (!TOKEN) {
  console.error('HEALTH_TOKEN not set — add it to .env.local');
  process.exit(1);
}

const URL = process.env.HEALTH_INGEST_URL ?? 'https://imlunahey.com/api/health';

// 250ms between chunks. Cloudflare's KV write rate-limit is generous
// enough that we don't strictly need this, but it makes the log
// readable and avoids any burstiness if the worker tail is sleepy.
const BETWEEN_MS = 250;
// Retry policy for transient 5xx — typically a cold worker isolate
// or KV propagation hiccup, both resolve on retry.
const MAX_ATTEMPTS = 4;

type HaePoint = Record<string, string | number | undefined> & { date?: string };
type HaeMetric = { name?: string; units?: string; data?: HaePoint[] };
type HaeWorkout = Record<string, unknown> & { start?: string };
type HaeFile = { data?: { metrics?: HaeMetric[]; workouts?: HaeWorkout[] } };

/** We keep every workout field — including the heavy per-minute
 *  `heartRateData` and `route` arrays — so the page can render HR
 *  curves and (eventually) maps per workout. Only `metadata`, which
 *  is always an empty object in HAE's output, gets dropped as a
 *  courtesy. If a per-month chunk gets too big to POST, the script
 *  will fall back to weekly chunking automatically (see below). */
function leanWorkout(w: HaeWorkout): HaeWorkout {
  const out: HaeWorkout = {};
  for (const [k, v] of Object.entries(w)) {
    if (k === 'metadata') continue;
    out[k] = v;
  }
  return out;
}

function monthOf(date: string | undefined): string | null {
  if (!date) return null;
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 7);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readFile(): HaeFile {
  const raw = readFileSync(FILE, 'utf8');
  const parsed = JSON.parse(raw) as HaeFile;
  // tolerate the wrapped or unwrapped shape, like the server does
  if (parsed.data) return parsed;
  return { data: parsed as unknown as HaeFile['data'] };
}

type MonthChunk = {
  month: string;
  metrics: Map<string, HaeMetric>;
  workouts: HaeWorkout[];
  /** approximate point count, for log telemetry only */
  points: number;
};

function bucketByMonth(file: HaeFile): MonthChunk[] {
  const byMonth = new Map<string, MonthChunk>();
  const get = (m: string): MonthChunk => {
    let b = byMonth.get(m);
    if (!b) {
      b = { month: m, metrics: new Map<string, HaeMetric>(), workouts: [], points: 0 };
      byMonth.set(m, b);
    }
    return b;
  };

  for (const m of file.data?.metrics ?? []) {
    if (!m.name) continue;
    for (const p of m.data ?? []) {
      const month = monthOf(p.date);
      if (!month) continue;
      const b = get(month);
      let metric = b.metrics.get(m.name);
      if (!metric) {
        metric = { name: m.name, units: m.units, data: [] };
        b.metrics.set(m.name, metric);
      } else if (!metric.units && m.units) {
        metric.units = m.units;
      }
      metric.data!.push(p);
      b.points++;
    }
  }

  for (const w of file.data?.workouts ?? []) {
    const month = monthOf(typeof w.start === 'string' ? w.start : undefined);
    if (!month) continue;
    const b = get(month);
    b.workouts.push(leanWorkout(w));
  }

  // newest months first so the most-recent / most-relevant data lands
  // in KV before the older backfill catches up; the page already
  // shows latest months, so partial completion still feels responsive.
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function chunkBody(chunk: MonthChunk): string {
  return JSON.stringify({
    data: {
      metrics: [...chunk.metrics.values()],
      workouts: chunk.workouts,
    },
  });
}

async function postChunk(chunk: MonthChunk): Promise<{ ok: boolean; status: number; body: string }> {
  const body = chunkBody(chunk);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    const text = await res.text();
    if (res.ok) return { ok: true, status: res.status, body: text };
    // 4xx isn't retryable (bad token, malformed body, etc.) — break early.
    if (res.status >= 400 && res.status < 500) {
      return { ok: false, status: res.status, body: text };
    }
    // 5xx — backoff + retry. linear is fine for the small attempt counts here.
    if (attempt < MAX_ATTEMPTS) {
      const wait = 1000 * attempt;
      console.log(`    ${res.status}, retry in ${wait}ms (attempt ${attempt}/${MAX_ATTEMPTS - 1})`);
      await sleep(wait);
    } else {
      return { ok: false, status: res.status, body: text };
    }
  }
  return { ok: false, status: 0, body: 'unreachable' };
}

async function main() {
  console.log(`reading ${FILE}…`);
  const file = readFile();
  const chunks = bucketByMonth(file);
  console.log(`split into ${chunks.length} months`);
  console.log('');

  let okCount = 0;
  let failCount = 0;
  const failures: Array<{ month: string; status: number; body: string }> = [];

  for (const chunk of chunks) {
    const sizeKb = Math.round(chunkBody(chunk).length / 1024);
    process.stdout.write(
      `${chunk.month}  metrics=${chunk.metrics.size}  points=${chunk.points}  workouts=${chunk.workouts.length}  size=${sizeKb}kb  →  `,
    );
    const r = await postChunk(chunk);
    if (r.ok) {
      console.log('200 ok');
      okCount++;
    } else {
      console.log(`${r.status} ${r.body.slice(0, 120)}`);
      failCount++;
      failures.push({ month: chunk.month, status: r.status, body: r.body.slice(0, 200) });
    }
    await sleep(BETWEEN_MS);
  }

  console.log('');
  console.log(`done. ok=${okCount}  fail=${failCount}`);
  if (failures.length > 0) {
    console.log('');
    console.log('failures:');
    for (const f of failures) {
      console.log(`  ${f.month}: ${f.status}  ${f.body}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
