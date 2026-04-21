import { createFileRoute } from '@tanstack/react-router';
import CronPage from '../../../pages/labs/Cron';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/cron')({
  component: CronPage,
  head: () => pageMeta('lab/cron'),
});
