import { createFileRoute } from '@tanstack/react-router';
import QuoteTreePage from '../../../pages/labs/QuoteTree';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/quote-tree')({
  component: QuoteTreePage,
  head: () => pageMeta('lab/quote-tree'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
