import { createFileRoute } from '@tanstack/react-router';
import PdsHealthPage from '../../../pages/labs/PdsHealth';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/pds-health')({
  component: PdsHealthPage,
  head: () => pageMeta('lab/pds-health'),
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === 'string' ? search.url : undefined,
  }),
});
