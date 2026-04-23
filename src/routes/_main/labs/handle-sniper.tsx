import { createFileRoute } from '@tanstack/react-router';
import HandleSniperPage from '../../../pages/labs/HandleSniper';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/handle-sniper')({
  component: HandleSniperPage,
  head: () => pageMeta('lab/handle-sniper'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
