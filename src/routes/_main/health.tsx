import { createFileRoute } from '@tanstack/react-router';
import HealthPage from '../../pages/Health';
import { pageMeta } from '../../lib/og-meta';
import { getHealth } from '../../server/health';

export const Route = createFileRoute('/_main/health')({
  loader: () => getHealth(),
  component: HealthPage,
  head: () => pageMeta('health'),
});
