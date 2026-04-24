import { createFileRoute } from '@tanstack/react-router';
import ListMembershipsPage from '../../../pages/labs/ListMemberships';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/list-memberships')({
  component: ListMembershipsPage,
  head: () => pageMeta('lab/list-memberships'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
