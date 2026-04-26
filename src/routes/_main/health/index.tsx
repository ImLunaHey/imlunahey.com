import { createFileRoute } from '@tanstack/react-router';
import HealthPage from '../../../pages/Health';
import { pageMeta } from '../../../lib/og-meta';
import { getHealth, getHealthArchive } from '../../../server/health';

export const Route = createFileRoute('/_main/health/')({
  loader: async () => ({
    snap: await getHealth(),
    archive: await getHealthArchive(),
    scope: { type: 'recent' as const },
  }),
  component: HealthPage,
  head: () => pageMeta('health'),
});
