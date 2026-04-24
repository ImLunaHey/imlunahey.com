import { createFileRoute } from '@tanstack/react-router';
import MetMuseumPage from '../../../pages/labs/MetMuseum';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/met-museum')({
  component: MetMuseumPage,
  head: () => pageMeta('lab/met-museum'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
