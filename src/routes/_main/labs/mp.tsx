import { createFileRoute } from '@tanstack/react-router';
import MPPage from '../../../pages/labs/MP';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/mp')({
  component: MPPage,
  head: () => pageMeta('lab/mp'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
