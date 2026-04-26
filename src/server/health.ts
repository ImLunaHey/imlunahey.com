import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

// Apple Health → /health page, fed by the Health Auto Export iOS app
// (https://www.healthexportapp.com/) which can be configured to POST a
// JSON snapshot of selected metrics + workouts on a schedule. We store
// the most recent push verbatim under a single KV key — each push is a
// rolling window (configurable in HAE; typically 7 or 30 days), so the
// stored snapshot already contains "history" up to that window without
// us having to merge incrementally.

/** A single timestamped data point within a metric's `data` array.
 *  Different metrics use different field names — sleep entries have
 *  `asleep`/`inBed`/`deep`/`rem`/`core`/`awake`, step counts use
 *  `qty`, etc. — so the type is open. */
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
  /** HAE includes lots of optional summary fields (avg/max heart rate,
   *  etc.) that vary by workout type. Keep the type open. */
  [key: string]: unknown;
};

export type HealthSnapshot = {
  /** server-side timestamp of the most recent successful push (ms) */
  ts: number;
  metrics: HealthMetric[];
  workouts: HealthWorkout[];
};

const KV_KEY = 'health:latest';

export const getHealth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HealthSnapshot | null> => {
    const kv = env.HOMELAB;
    if (!kv) return null;
    return (await kv.get<HealthSnapshot>(KV_KEY, { type: 'json' })) ?? null;
  },
);
