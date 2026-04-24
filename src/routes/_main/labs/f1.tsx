import { createFileRoute } from '@tanstack/react-router';
import F1Page from '../../../pages/labs/F1';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/f1')({
  component: F1Page,
  head: () => pageMeta('lab/f1'),
  validateSearch: (search: Record<string, unknown>) => ({
    year: typeof search.year === 'number' ? search.year : typeof search.year === 'string' ? Number(search.year) || undefined : undefined,
    round: typeof search.round === 'number' ? search.round : typeof search.round === 'string' ? Number(search.round) || undefined : undefined,
  }),
});
