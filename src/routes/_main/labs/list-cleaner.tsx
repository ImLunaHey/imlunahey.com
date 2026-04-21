import { createFileRoute } from '@tanstack/react-router';
import ListCleanerPage from '../../../pages/labs/ListCleaner';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/list-cleaner')({
  component: ListCleanerPage,
  head: () => pageMeta('lab/list-cleaner'),
});
