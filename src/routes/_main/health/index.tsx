import { createFileRoute } from '@tanstack/react-router';
import HealthPage from '../../../pages/Health';
import { pageMeta } from '../../../lib/og-meta';
import {
  getHealth,
  getHealthArchive,
  getHealthLatest,
  getHealthLifetime,
} from '../../../server/health';

export const Route = createFileRoute('/_main/health/')({
  // lifetime aggregator runs N KV reads (one per month) so we only
  // load it on the index, not on the per-month or workout-detail
  // routes which set lifetime to null.
  loader: async () => {
    // Fire all four KV-backed reads in parallel — the snapshot's
    // 6 month-bucket fetches can overlap with the index, lifetime,
    // and latest reads instead of running sequentially.
    const [snap, archive, lifetime, latest] = await Promise.all([
      getHealth(),
      getHealthArchive(),
      getHealthLifetime(),
      getHealthLatest(),
    ]);
    return { snap, archive, lifetime, latest, scope: { type: 'recent' as const } };
  },
  component: HealthPage,
  head: () => pageMeta('health'),
});
