import { createFileRoute } from '@tanstack/react-router';
import TvmazePage from '../../../pages/labs/Tvmaze';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/tvmaze')({
  component: TvmazePage,
  head: () => pageMeta('lab/tvmaze'),
  validateSearch: (search: Record<string, unknown>) => ({
    mode: typeof search.mode === 'string' ? search.mode : undefined,
    country: typeof search.country === 'string' ? search.country : undefined,
    date: typeof search.date === 'string' ? search.date : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
