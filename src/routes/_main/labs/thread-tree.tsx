import { createFileRoute } from '@tanstack/react-router';
import ThreadTreePage from '../../../pages/labs/ThreadTree';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/thread-tree')({
  component: ThreadTreePage,
  head: () => pageMeta('lab/thread-tree'),
  validateSearch: (search: Record<string, unknown>) => ({
    uri: typeof search.uri === 'string' ? search.uri : undefined,
  }),
});
