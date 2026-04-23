import { createFileRoute } from '@tanstack/react-router';
import DidLogPage from '../../../pages/labs/DidLog';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/did-log')({
  component: DidLogPage,
  head: () => pageMeta('lab/did-log'),
  validateSearch: (search: Record<string, unknown>) => ({
    actor: typeof search.actor === 'string' ? search.actor : undefined,
  }),
});
