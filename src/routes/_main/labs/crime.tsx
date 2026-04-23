import { createFileRoute } from '@tanstack/react-router';
import CrimePage from '../../../pages/labs/Crime';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/crime')({
  component: CrimePage,
  head: () => pageMeta('lab/crime'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
