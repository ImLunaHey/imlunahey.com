import { createFileRoute } from '@tanstack/react-router';
import AtUriPage from '../../../../pages/labs/AtUri';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/at-uri/$')({
  component: AtUriPage,
  head: () => pageMeta('lab/at-uri'),
});
