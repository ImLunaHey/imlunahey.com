import { createFileRoute } from '@tanstack/react-router';
import TopPostsPage from '../../../pages/labs/TopPosts';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/top-posts')({
  component: TopPostsPage,
  head: () => pageMeta('lab/top-posts'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
});
