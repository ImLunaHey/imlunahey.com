import { createFileRoute } from '@tanstack/react-router';
import CertsPage from '../../../pages/labs/Certs';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/certs')({
  component: CertsPage,
  head: () => pageMeta('lab/certs'),
  validateSearch: (search: Record<string, unknown>) => ({
    domain: typeof search.domain === 'string' ? search.domain : undefined,
  }),
});
