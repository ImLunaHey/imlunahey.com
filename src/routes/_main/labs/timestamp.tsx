import { createFileRoute } from '@tanstack/react-router';
import TimestampPage from '../../../pages/labs/Timestamp';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/timestamp')({
  component: TimestampPage,
  head: () => pageMeta('lab/timestamp'),
});
