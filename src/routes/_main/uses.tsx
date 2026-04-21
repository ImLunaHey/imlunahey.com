import { createFileRoute } from '@tanstack/react-router';
import UsesPage from '../../pages/Uses';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/uses')({
  component: UsesPage,
  head: () => pageMeta('uses'),
});
