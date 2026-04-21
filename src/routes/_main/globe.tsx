import { createFileRoute } from '@tanstack/react-router';
import GlobePage from '../../pages/Globe';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/globe')({
  component: GlobePage,
  head: () => pageMeta('globe'),
});
