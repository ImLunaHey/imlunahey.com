import { createFileRoute } from '@tanstack/react-router';
import TflStatusPage from '../../../pages/labs/TflStatus';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tfl-status')({
  component: TflStatusPage,
  head: () => pageMeta('lab/tfl-status'),
});
