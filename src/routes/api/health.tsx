import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import {
  HEALTH_INDEX_KEY,
  HEALTH_LATEST_KEY,
  applyLatestUpdates,
  healthMonthKey,
  monthOf,
  type HealthIndex,
  type HealthLatest,
  type HealthMetric,
  type HealthMetricPoint,
  type HealthWorkout,
} from '../../server/health';

/**
 * /api/health — receive a Health Auto Export JSON push from iOS.
 *
 *   GET                              → latest snapshot (rolling window
 *                                       across the most recent N months)
 *   POST  Authorization: Bearer HEALTH_TOKEN
 *         body: { data: { metrics, workouts } }   (HAE schema)
 *
 * Each push is bucketed by month — every metric data point and workout
 * is filed under the YYYY-MM derived from its own `date`/`start`
 * field. Existing month buckets are read, merged with the incoming
 * data (deduped on date+source / start+name), and written back. So
 * pushing the "last 7 days" today and "last 30 days" next week
 * accumulates into a single rolling history rather than overwriting,
 * and pushing an *old* time range later (HAE's "Aggregate Data" lets
 * you backfill) lands cleanly in its own historical bucket without
 * disturbing more-recent months.
 *
 * Token-only auth (no HMAC) is fine for the personal-site threat
 * model: leaked-token worst case is junk data getting filed into a
 * month, which is reversible by deleting the affected month key.
 */

type HaeBody = {
  data?: {
    metrics?: Array<{ name?: string; units?: string; data?: HealthMetricPoint[] }>;
    workouts?: HealthWorkout[];
  };
};

type MonthBucket = {
  ts: number;
  metrics: HealthMetric[];
  workouts: HealthWorkout[];
};

type IngestSummary = {
  monthsTouched: string[];
  totalMetricPoints: number;
  totalWorkouts: number;
};

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const kv = env.HOMELAB;
        if (!kv) return Response.json(null, { status: 503 });
        const idx = await kv.get<HealthIndex>(HEALTH_INDEX_KEY, { type: 'json' });
        return Response.json(idx ?? null);
      },
      POST: async ({ request }: { request: Request }) => {
        const token = process.env.HEALTH_TOKEN;
        if (!token) return new Response('no token configured', { status: 503 });

        const auth = request.headers.get('authorization') ?? '';
        const sent = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (sent !== token) return new Response('unauthorized', { status: 401 });

        let body: HaeBody;
        try {
          body = (await request.json()) as HaeBody;
        } catch {
          return new Response('invalid json', { status: 400 });
        }

        const wrapped = body.data ?? (body as unknown as HaeBody['data']);
        const incomingMetrics = wrapped?.metrics ?? [];
        const incomingWorkouts = wrapped?.workouts ?? [];

        const kv = env.HOMELAB;
        if (!kv) return new Response('no kv binding', { status: 503 });

        const summary = await ingest(kv, incomingMetrics, incomingWorkouts);
        return Response.json({ ok: true, ...summary, ts: Date.now() });
      },
    },
  },
});

async function ingest(
  kv: KVNamespace,
  incomingMetrics: HaeBody['data'] extends infer T
    ? T extends { metrics?: infer M }
      ? NonNullable<M>
      : never
    : never,
  incomingWorkouts: HealthWorkout[],
): Promise<IngestSummary> {
  // Group incoming metric data points by month-of-date. A metric whose
  // points span multiple months gets fanned out: same metric name
  // appears in each month's bucket, holding only that month's points.
  const byMonth = new Map<
    string,
    { metrics: Map<string, HealthMetric>; workouts: HealthWorkout[] }
  >();
  let totalMetricPoints = 0;

  for (const m of incomingMetrics) {
    if (!m.name) continue;
    for (const p of m.data ?? []) {
      const month = monthOf(p.date);
      if (!month) continue;
      let bucket = byMonth.get(month);
      if (!bucket) {
        bucket = { metrics: new Map<string, HealthMetric>(), workouts: [] };
        byMonth.set(month, bucket);
      }
      let metric = bucket.metrics.get(m.name);
      if (!metric) {
        metric = { name: m.name, units: m.units, data: [] };
        bucket.metrics.set(m.name, metric);
      } else if (!metric.units && m.units) {
        metric.units = m.units;
      }
      metric.data.push(p);
      totalMetricPoints++;
    }
  }

  for (const w of incomingWorkouts) {
    const month = monthOf(typeof w.start === 'string' ? w.start : undefined);
    if (!month) continue;
    let bucket = byMonth.get(month);
    if (!bucket) {
      bucket = { metrics: new Map<string, HealthMetric>(), workouts: [] };
      byMonth.set(month, bucket);
    }
    bucket.workouts.push(w);
  }

  // Read existing month buckets in parallel, merge, write back.
  const months = [...byMonth.keys()];
  const existing = await Promise.all(
    months.map((m) => kv.get<MonthBucket>(healthMonthKey(m), { type: 'json' })),
  );

  const writes: Promise<unknown>[] = [];
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const fresh = byMonth.get(month);
    if (!fresh) continue;
    const merged = mergeIntoBucket(existing[i], fresh);
    writes.push(kv.put(healthMonthKey(month), JSON.stringify(merged)));
  }

  // Update the index with whatever months are now present (incoming +
  // anything already there). Sorted newest-first for the page's
  // "archive" rendering.
  const idx = await kv.get<HealthIndex>(HEALTH_INDEX_KEY, { type: 'json' });
  const nextMonths = new Set<string>(idx?.months ?? []);
  for (const m of months) nextMonths.add(m);
  const nextIdx: HealthIndex = {
    months: [...nextMonths].sort().reverse(),
    lastUpdated: Date.now(),
  };
  writes.push(kv.put(HEALTH_INDEX_KEY, JSON.stringify(nextIdx)));

  // Maintain health:latest — sparse metrics (weight/BMI/body-fat/etc.)
  // get filed here on newest-date-wins so the page can render them
  // without scanning every month.
  const prevLatest = await kv.get<HealthLatest>(HEALTH_LATEST_KEY, { type: 'json' });
  const { next: nextLatest, changed } = applyLatestUpdates(prevLatest, incomingMetrics);
  if (changed) {
    writes.push(kv.put(HEALTH_LATEST_KEY, JSON.stringify(nextLatest)));
  }

  await Promise.all(writes);

  return {
    monthsTouched: months,
    totalMetricPoints,
    totalWorkouts: incomingWorkouts.length,
  };
}

function mergeIntoBucket(
  prev: MonthBucket | null,
  fresh: { metrics: Map<string, HealthMetric>; workouts: HealthWorkout[] },
): MonthBucket {
  const metricsByName = new Map<
    string,
    { units?: string; pts: Map<string, HealthMetricPoint> }
  >();

  if (prev) {
    for (const m of prev.metrics ?? []) {
      const pts = new Map<string, HealthMetricPoint>();
      for (const p of m.data ?? []) {
        const key = `${p.date ?? ''}|${(p.source as string | undefined) ?? ''}`;
        pts.set(key, p);
      }
      metricsByName.set(m.name, { units: m.units, pts });
    }
  }

  for (const [name, m] of fresh.metrics) {
    let entry = metricsByName.get(name);
    if (!entry) {
      entry = { units: m.units, pts: new Map<string, HealthMetricPoint>() };
      metricsByName.set(name, entry);
    } else if (!entry.units && m.units) {
      entry.units = m.units;
    }
    for (const p of m.data ?? []) {
      const key = `${p.date ?? ''}|${(p.source as string | undefined) ?? ''}`;
      entry.pts.set(key, p);
    }
  }

  const metrics: HealthMetric[] = [];
  for (const [name, { units, pts }] of metricsByName) {
    metrics.push({ name, units, data: [...pts.values()] });
  }

  const workoutsByKey = new Map<string, HealthWorkout>();
  for (const w of prev?.workouts ?? []) {
    const key = `${(w.start as string | undefined) ?? ''}|${w.name ?? ''}`;
    workoutsByKey.set(key, w);
  }
  for (const w of fresh.workouts) {
    const key = `${(w.start as string | undefined) ?? ''}|${w.name ?? ''}`;
    workoutsByKey.set(key, w);
  }

  return {
    ts: Date.now(),
    metrics,
    workouts: [...workoutsByKey.values()],
  };
}
