import { createFileRoute } from '@tanstack/react-router';
import LifePage from '../../../pages/labs/Life';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/life')({
  component: LifePage,
  head: () => pageMeta('lab/life'),
});
