import { createFileRoute } from '@tanstack/react-router';
import PoetryPage from '../../../pages/labs/Poetry';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/poetry')({
  component: PoetryPage,
  head: () => pageMeta('lab/poetry'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    mode: typeof search.mode === 'string' ? search.mode : undefined,
  }),
});
