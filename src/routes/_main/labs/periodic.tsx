import { createFileRoute } from '@tanstack/react-router';
import PeriodicPage from '../../../pages/labs/Periodic';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/periodic')({
  component: PeriodicPage,
  head: () => pageMeta('lab/periodic'),
});
