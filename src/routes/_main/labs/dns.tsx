import { createFileRoute } from '@tanstack/react-router';
import DnsPage from '../../../pages/labs/Dns';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/dns')({
  component: DnsPage,
  head: () => pageMeta('lab/dns'),
  validateSearch: (search: Record<string, unknown>) => ({
    name: typeof search.name === 'string' ? search.name : undefined,
    type: typeof search.type === 'string' ? search.type : undefined,
  }),
});
