import { createFileRoute } from '@tanstack/react-router';
import WhoisPage from '../../../pages/labs/Whois';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/whois')({
  component: WhoisPage,
  head: () => pageMeta('lab/whois'),
  validateSearch: (search: Record<string, unknown>) => ({
    domain: typeof search.domain === 'string' ? search.domain : undefined,
  }),
});
