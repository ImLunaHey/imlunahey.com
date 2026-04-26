import { createFileRoute } from '@tanstack/react-router';
import HealthPage from '../../../pages/Health';
import { pageMeta } from '../../../lib/og-meta';
import { getHealthMonth, getHealthArchive } from '../../../server/health';

export const Route = createFileRoute('/_main/health/m/$month')({
  loader: async ({ params }) => {
    const [snap, archive] = await Promise.all([
      getHealthMonth({ data: { month: params.month } }),
      getHealthArchive(),
    ]);
    return {
      snap,
      archive,
      lifetime: null,
      latest: null,
      scope: { type: 'month' as const, month: params.month },
    };
  },
  component: HealthPage,
  head: ({ params }) => pageMeta('health', { path: `/health/m/${params.month}` }),
});
