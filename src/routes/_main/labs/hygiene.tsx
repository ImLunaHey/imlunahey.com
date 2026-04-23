import { createFileRoute } from '@tanstack/react-router';
import HygienePage from '../../../pages/labs/Hygiene';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/hygiene')({
  component: HygienePage,
  head: () => pageMeta('lab/hygiene'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
