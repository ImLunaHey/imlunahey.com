import { createFileRoute } from '@tanstack/react-router';
import DiffPage from '../../../pages/labs/Diff';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/diff')({
  component: DiffPage,
  head: () => pageMeta('lab/diff'),
});
