import { createFileRoute } from '@tanstack/react-router';
import TopDomainsPage from '../../../pages/labs/TopDomains';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/top-domains')({
  component: TopDomainsPage,
  head: () => pageMeta('lab/top-domains'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
