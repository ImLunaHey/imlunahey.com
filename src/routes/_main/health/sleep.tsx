import { createFileRoute } from '@tanstack/react-router';
import HealthSleepPage from '../../../pages/HealthSleep';
import { pageMeta } from '../../../lib/og-meta';
import { getHealth } from '../../../server/health';

export const Route = createFileRoute('/_main/health/sleep')({
  loader: () => getHealth(),
  component: HealthSleepPage,
  head: () => pageMeta('health', { path: '/health/sleep' }),
});
