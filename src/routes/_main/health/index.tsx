import { createFileRoute } from '@tanstack/react-router';
import HealthPage from '../../../pages/Health';
import { pageMeta } from '../../../lib/og-meta';
import {
  getHealth,
  getHealthArchive,
  getHealthLifetime,
} from '../../../server/health';

export const Route = createFileRoute('/_main/health/')({
  // lifetime aggregator runs N KV reads (one per month) so we only
  // load it on the index, not on the per-month or workout-detail
  // routes which set lifetime to null.
  loader: async () => ({
    snap: await getHealth(),
    archive: await getHealthArchive(),
    lifetime: await getHealthLifetime(),
    scope: { type: 'recent' as const },
  }),
  component: HealthPage,
  head: () => pageMeta('health'),
});
