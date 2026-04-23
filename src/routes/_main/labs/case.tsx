import { createFileRoute } from '@tanstack/react-router';
import CasePage from '../../../pages/labs/Case';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/case')({
  component: CasePage,
  head: () => pageMeta('lab/case'),
});
