import { createFileRoute } from '@tanstack/react-router';
import FirehoseStatsPage from '../../../pages/labs/FirehoseStats';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/firehose-stats')({
  component: FirehoseStatsPage,
  head: () => pageMeta('lab/firehose-stats'),
});
