import { createFileRoute } from '@tanstack/react-router';
import XkcdPage from '../../../pages/labs/Xkcd';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/xkcd')({
  component: XkcdPage,
  head: () => pageMeta('lab/xkcd'),
  validateSearch: (search: Record<string, unknown>) => ({
    n: typeof search.n === 'number' ? search.n : typeof search.n === 'string' ? Number(search.n) || undefined : undefined,
  }),
});
