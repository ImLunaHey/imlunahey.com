import { createFileRoute } from '@tanstack/react-router';
import CryptoPage from '../../../../pages/labs/Crypto';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/crypto/')({
  component: CryptoPage,
  head: () => pageMeta('lab/crypto'),
  validateSearch: (search: Record<string, unknown>) => ({
    cur: typeof search.cur === 'string' ? search.cur : undefined,
    period: typeof search.period === 'string' ? search.period : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
