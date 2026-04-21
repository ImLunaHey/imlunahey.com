import { createFileRoute } from '@tanstack/react-router';
import FeedPage from '../../../../pages/labs/Feed';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/feed/')({
  component: FeedPage,
  head: () => pageMeta('lab/feed'),
});
